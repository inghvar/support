<template>
  <div class="canvas-container">
    <canvas class="div-canvas" ref="commonCanvas"></canvas>
    <canvas class="div-canvas" id="arrowCanvas" ref="arrowCanvas"></canvas>

    <div class="view-buttons">
      <v-btn-toggle
        v-if="hasPart"
        v-model="carvingView"
        mandatory
        class="mr-4 carving-view-toggle"
        @update:model-value="onCarvingViewChange"
      >
        <v-btn value="part">Part</v-btn>
        <v-btn value="toolpath">Toolpath</v-btn>
      </v-btn-toggle>

      <v-btn color="success" class="mr-4 save-editor" @click="frontView">
        <FrontIcon />
      </v-btn>

      <v-btn color="success" class="mr-4 save-editor" @click="topView">
        <TopIcon />
      </v-btn>

      <v-btn color="success" class="mr-4 save-editor" @click="isometricView">
        <IsometricIcon />
      </v-btn>
    </div>

    <div class="arrow-legenda">
      <div class="coordinate-legendX">X</div>
      <div class="coordinate-legendY">Y</div>
      <div class="coordinate-legendZ">Z</div>
    </div>

    <v-dialog v-model="dialogp" persistent width="300">
      <v-card color="#a52906" dark>
        <v-card-text id="progress">
          Creating a preview
          <v-progress-linear v-model="progress" height="25" color="green">
            <strong>{{ Math.ceil(progress) }}%</strong>
          </v-progress-linear>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  checkGcodeMode,
  linearInterpolation,
  circularInterpolation,
  prepareGcode,
  checkUsedGcode,
  checkPlaneMode,
  checkPositioningSystem,
  checkUnitSystem,
  scaleLine,
  linearInterpolationIncremental
} from '../assets/js/gcodeParse'
import {
  buildDepthField,
  parseCuttingSegments
} from '../assets/js/engravingSurface'

import TopIcon from './TopIcon.vue'
import FrontIcon from './FrontIcon.vue'
import IsometricIcon from './IsometricIcon.vue'

const ENGRAVING_VERTEX_SHADER = `
  varying vec3 vWorld;
  void main () {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

// The top face is the plane y = 0. A ray that meets it above a groove is
// followed down until it reaches the bottom or the wall of the groove.
const ENGRAVING_FRAGMENT_SHADER = `
  uniform mat4 projectionMatrix;
  uniform sampler2D uDepth;
  uniform vec2 uOrigin;
  uniform vec2 uSize;
  uniform float uPixel;
  uniform float uMaxDepth;
  uniform float uTop;
  uniform vec3 uColor;
  uniform vec3 uLight;
  varying vec3 vWorld;

  // depth of the groove under the point (x, z); machine Y = -z
  float depthAt (vec2 xz) {
    vec2 uv = vec2(
      (xz.x - uOrigin.x) / uSize.x,
      (-xz.y - uOrigin.y) / uSize.y
    );
    return texture2D(uDepth, uv).r;
  }

  void main () {
    vec3 dir = projectionMatrix[3][3] == 1.0
      ? -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2])
      : normalize(vWorld - cameraPosition);

    vec3 hit = vWorld;
    float t = 0.0;
    float grooveDepth = depthAt(vWorld.xz);

    if (grooveDepth > 0.002 && dir.y < -1e-4) {
      float tMax = (uMaxDepth + 0.01) / -dir.y;
      float lo = 0.0;
      float hi = tMax;
      for (int i = 1; i <= 160; i++) {
        float ti = tMax * float(i) / 160.0;
        vec3 p = vWorld + dir * ti;
        if (uTop - p.y > depthAt(p.xz)) {
          hi = ti;
          break;
        }
        lo = ti;
      }
      for (int i = 0; i < 12; i++) {
        float mid = 0.5 * (lo + hi);
        vec3 p = vWorld + dir * mid;
        if (uTop - p.y > depthAt(p.xz)) hi = mid; else lo = mid;
      }
      t = hi;
      hit = vWorld + dir * t;
    }

    vec3 normal = vec3(0.0, 1.0, 0.0);
    float shade = 1.0;
    if (t > 0.0) {
      vec2 e = vec2(uPixel, 0.0);
      float dx = depthAt(hit.xz + e.xy) - depthAt(hit.xz - e.xy);
      float dz = depthAt(hit.xz + e.yx) - depthAt(hit.xz - e.yx);
      normal = normalize(vec3(dx, 2.0 * uPixel, dz));
      shade = 1.0 - 0.25 * clamp(depthAt(hit.xz) / uMaxDepth, 0.0, 1.0);
    }

    float light = 0.55 + 0.8 * max(dot(normal, uLight), 0.0);
    gl_FragColor = vec4(uColor * light * shade, 1.0);

    vec4 clip = projectionMatrix * viewMatrix * vec4(hit, 1.0);
    gl_FragDepth = (clip.z / clip.w) * 0.5 + 0.5;
  }
`

export default {
  name: 'ThreeCanvasHelp',
  props: {
    gcodeSource: {
      required: true
    },
    // carved part surface from the backend; when set, the part is shown first
    carvingPreview: {
      type: Object,
      default: null
    },
    // tool of the engraving { type, diameter, angle, thickness }; the grooves
    // are calculated here from the G-code
    engravingTool: {
      type: Object,
      default: null
    }
  },
  components: {
    TopIcon,
    FrontIcon,
    IsometricIcon
  },
  data() {
    return {
      carvingView: 'part',
      hasPart: false,
      toolpathLoaded: false,

      progress: null,
      dialogp: false,
      isLongGcode: false,

      coordinateX: 0,
      coordinateY: 0,
      coordinateZ: 0,
      unitScale: 1, // 25.4 while the G-code is in inches (G20), the scene is drawn in mm
      axisUnit: 'mm'
    }
  },
  mounted() {
    const lines = this.gcodeSource.split('\n')
    // console.log(lines)
    this.isLongGcode = lines.length > 10000
    // Three.js objects
    this.renderer = null
    this.scene = null
    this.camera = null
    this.controls = null
    this.arrowRenderer = null
    this.arrowScene = null
    this.arrowCamera = null
    this.gridHelper = null
    this.linesInterpolation = null
    this.dotsInterpolation = null

    this.listModes = []
    this.linearPoints = []
    this.linearPointsToShow = []
    this.pointsPath = []
    this.partGroup = null

    this.tmpStartVec = null
    this.tmpEndVec = null

    if (this.carvingPreview || this.engravingTool) {
      this.initThree()
      this.hasPart = this.carvingPreview
        ? (this.buildPart(), true)
        : this.buildEngravingPart()
      this.animate()
      if (this.hasPart) return
      this.isLongGcode = this.gcodeSource.split('\n').length > 10000
      this.dialogp = this.isLongGcode
      this.editorRun()
      return
    }

    this.initThree()
    if (this.isLongGcode) {
      this.dialogp = true
    }
    this.animate()
    this.editorRun()
  },
  beforeUnmount() {
    cancelAnimationFrame(this.id)
    if (this.partGroup) {
      this.disposePart()
    }
    if (this.axisLabels) {
      this.axisLabels.children.forEach(sprite => {
        sprite.material.map.dispose()
        sprite.material.dispose()
      })
    }
    if (this.renderer) this.renderer.dispose()
    if (this.arrowRenderer) this.arrowRenderer.dispose()
  },
  methods: {
    onCarvingViewChange(view) {
      const showPart = view === 'part'
      if (this.partGroup) this.partGroup.visible = showPart
      if (!showPart && !this.toolpathLoaded) {
        this.toolpathLoaded = true
        this.isLongGcode = this.gcodeSource.split('\n').length > 10000
        this.editorRun()
        return
      }
      if (this.linesInterpolation) this.linesInterpolation.visible = !showPart
      if (this.dotsInterpolation) this.dotsInterpolation.visible = !showPart
    },

    disposePart() {
      this.partGroup.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) obj.material.dispose()
      })
      this.scene.remove(this.partGroup)
      this.partGroup = null
    },

    /**
     * Builds the solid part from the depth map of the carved surface.
     * Machine X -> three x, machine Y -> three -z, height above the table
     * (thickness - depth below the top) -> three y, the table is y = 0.
     */
    buildPart() {
      const { rows, cols, dx, dy, thickness } = this.carvingPreview
      // optional: grid offset and Z of the workpiece top (engraving, Z0 = top)
      const x0 = this.carvingPreview.x0 || 0
      const y0 = this.carvingPreview.y0 || 0
      const topZ =
        this.carvingPreview.top_z !== undefined
          ? this.carvingPreview.top_z
          : thickness

      const bytes = Uint8Array.from(atob(this.carvingPreview.depth), c =>
        c.charCodeAt(0)
      )
      const depth = new Uint16Array(bytes.buffer)

      // the grid is decimated when it is too dense for the screen
      const stride = Math.max(1, Math.ceil(Math.max(rows, cols) / 900))
      const rowIdx = []
      for (let i = 0; i < rows; i += stride) rowIdx.push(i)
      if (rowIdx[rowIdx.length - 1] !== rows - 1) rowIdx.push(rows - 1)
      const colIdx = []
      for (let j = 0; j < cols; j += stride) colIdx.push(j)
      if (colIdx[colIdx.length - 1] !== cols - 1) colIdx.push(cols - 1)

      const nr = rowIdx.length
      const nc = colIdx.length
      const k = thickness / 65535

      const top = new Float32Array(nr * nc * 3)
      for (let r = 0; r < nr; r++) {
        for (let c = 0; c < nc; c++) {
          const o = (r * nc + c) * 3
          top[o] = x0 + colIdx[c] * dx
          top[o + 1] = topZ - depth[rowIdx[r] * cols + colIdx[c]] * k
          top[o + 2] = -(y0 + rowIdx[r] * dy)
        }
      }

      const index = new Uint32Array((nr - 1) * (nc - 1) * 6)
      let t = 0
      for (let r = 0; r < nr - 1; r++) {
        for (let c = 0; c < nc - 1; c++) {
          const a = r * nc + c
          const b = a + nc
          index[t++] = a
          index[t++] = a + 1
          index[t++] = b
          index[t++] = a + 1
          index[t++] = b + 1
          index[t++] = b
        }
      }

      const topGeometry = new THREE.BufferGeometry()
      topGeometry.setAttribute('position', new THREE.BufferAttribute(top, 3))
      topGeometry.setIndex(new THREE.BufferAttribute(index, 1))
      topGeometry.computeVertexNormals()

      // side walls and bottom of the workpiece
      const bottomY = topZ - thickness
      const wall = []
      const addWall = (p0, p1) => {
        wall.push(
          p0[0], p0[1], p0[2],
          p1[0], p1[1], p1[2],
          p1[0], bottomY, p1[2],
          p0[0], p0[1], p0[2],
          p1[0], bottomY, p1[2],
          p0[0], bottomY, p0[2]
        )
      }
      const vertex = (r, c) => {
        const o = (r * nc + c) * 3
        return [top[o], top[o + 1], top[o + 2]]
      }
      for (let c = 0; c < nc - 1; c++) {
        addWall(vertex(0, c), vertex(0, c + 1))
        addWall(vertex(nr - 1, c), vertex(nr - 1, c + 1))
      }
      for (let r = 0; r < nr - 1; r++) {
        addWall(vertex(r, 0), vertex(r + 1, 0))
        addWall(vertex(r, nc - 1), vertex(r + 1, nc - 1))
      }
      const xMin = x0
      const zMax = -y0
      const xMax = x0 + (cols - 1) * dx
      const zMin = -(y0 + (rows - 1) * dy)
      wall.push(
        xMin, bottomY, zMax, xMax, bottomY, zMax, xMax, bottomY, zMin,
        xMin, bottomY, zMax, xMax, bottomY, zMin, xMin, bottomY, zMin
      )
      const wallGeometry = new THREE.BufferGeometry()
      wallGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(wall, 3)
      )
      wallGeometry.computeVertexNormals()

      const material = new THREE.MeshStandardMaterial({
        color: 0xd9b382,
        roughness: 0.8,
        metalness: 0,
        side: THREE.DoubleSide
      })

      this.partGroup = new THREE.Group()
      this.partGroup.add(new THREE.Mesh(topGeometry, material))
      this.partGroup.add(new THREE.Mesh(wallGeometry, material.clone()))
      // Three.js r155+ no longer scales light intensity by PI
      this.partGroup.add(new THREE.AmbientLight(0xffffff, 0.55 * Math.PI))
      const sun = new THREE.DirectionalLight(0xffffff, 0.8 * Math.PI)
      sun.position.set(-300, 600, 400)
      this.partGroup.add(sun)
      this.scene.add(this.partGroup)
    },

    /**
     * Builds the engraved part: a flat top face whose grooves are traced per
     * pixel in the shader from the depth map, so their walls stay smooth at
     * any zoom, and the side walls of the plate.
     * Returns false when the G-code cuts nothing.
     */
    buildEngravingPart() {
      const tool = {
        type: this.engravingTool.type,
        diameter: this.engravingTool.diameter,
        angle: this.engravingTool.angle
      }
      const plateTop = this.engravingTool.thickness
      const field = buildDepthField(
        parseCuttingSegments(this.gcodeSource, plateTop),
        tool,
        Math.min(4096, this.renderer.capabilities.maxTextureSize)
      )
      if (!field) return false

      const { depth, cols, rows, x0, y0, pixel, maxDepth } = field
      const half = new Uint16Array(depth.length)
      for (let i = 0; i < depth.length; i++) {
        if (depth[i] > 0) half[i] = THREE.DataUtils.toHalfFloat(depth[i])
      }
      const texture = new THREE.DataTexture(
        half,
        cols,
        rows,
        THREE.RedFormat,
        THREE.HalfFloatType
      )
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.generateMipmaps = false
      texture.needsUpdate = true

      const width = cols * pixel
      const height = rows * pixel
      const xMax = x0 + width
      const zMax = -y0
      const zMin = -(y0 + height)

      const material = new THREE.ShaderMaterial({
        uniforms: {
          uDepth: { value: texture },
          uOrigin: { value: new THREE.Vector2(x0, y0) },
          uSize: { value: new THREE.Vector2(width, height) },
          uPixel: { value: pixel },
          uMaxDepth: { value: maxDepth },
          uTop: { value: plateTop },
          uColor: { value: new THREE.Color(0xd9b382) },
          uLight: { value: new THREE.Vector3(-300, 600, 400).normalize() }
        },
        vertexShader: ENGRAVING_VERTEX_SHADER,
        fragmentShader: ENGRAVING_FRAGMENT_SHADER
      })
      const top = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        material
      )
      top.rotation.x = -Math.PI / 2
      top.position.set(x0 + width / 2, plateTop, (zMax + zMin) / 2)

      const bottomY = 0
      const quad = (a, b, c, d) => [...a, ...b, ...c, ...a, ...c, ...d]
      const side = new THREE.BufferGeometry()
      side.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          [
            ...quad([x0, plateTop, zMax], [xMax, plateTop, zMax], [xMax, bottomY, zMax], [x0, bottomY, zMax]),
            ...quad([xMax, plateTop, zMax], [xMax, plateTop, zMin], [xMax, bottomY, zMin], [xMax, bottomY, zMax]),
            ...quad([xMax, plateTop, zMin], [x0, plateTop, zMin], [x0, bottomY, zMin], [xMax, bottomY, zMin]),
            ...quad([x0, plateTop, zMin], [x0, plateTop, zMax], [x0, bottomY, zMax], [x0, bottomY, zMin]),
            ...quad([x0, bottomY, zMax], [xMax, bottomY, zMax], [xMax, bottomY, zMin], [x0, bottomY, zMin])
          ],
          3
        )
      )
      side.computeVertexNormals()

      this.partGroup = new THREE.Group()
      this.partGroup.add(top)
      this.partGroup.add(
        new THREE.Mesh(
          side,
          new THREE.MeshStandardMaterial({
            color: 0xd9b382,
            roughness: 0.8,
            metalness: 0,
            side: THREE.DoubleSide
          })
        )
      )
      // Three.js r155+ no longer scales light intensity by PI
      this.partGroup.add(new THREE.AmbientLight(0xffffff, 0.55 * Math.PI))
      const sun = new THREE.DirectionalLight(0xffffff, 0.8 * Math.PI)
      sun.position.set(-300, 600, 400)
      this.partGroup.add(sun)
      this.scene.add(this.partGroup)
      return true
    },

    initThree() {
      // console.log(gcodeText)
      // vector for loops
      this.tmpStartVec = new THREE.Vector3()
      this.tmpEndVec = new THREE.Vector3()

      // The website runs Three.js r133 without color management; match its look
      THREE.ColorManagement.enabled = false

      const canvReference = this.$refs.commonCanvas
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        canvas: canvReference
      })
      this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace
      this.renderer.setClearColor(0xeaeaea, 1)
      const container = this.$refs.commonCanvas.parentElement
      const width = container.clientWidth || 800
      const height = 600

      this.scene = new THREE.Scene()

      this.renderer.setSize(width, height)

      this.camera = new THREE.OrthographicCamera(
        width / -8,
        width / 8,
        height / 8,
        height / -8,
        -6,
        10000
      )
      this.camera.position.x = 400
      this.camera.position.y = 400
      this.camera.position.z = 400

      this.controls = new OrbitControls(this.camera, this.renderer.domElement)
      this.controls.minDistance = 50
      this.controls.maxDistance = 1000
      this.controls.enableDamping = true
      // this.controls.enablePan = false

      // grid system
      this.gridHelper = new THREE.GridHelper(800, 80)
      this.gridHelper.material.opacity = 0.4
      this.gridHelper.material.transparent = true
      this.scene.add(this.gridHelper)
      this.buildAxisLabels()

      // ---------------------- inset arrow canvas ----------------------

      const CANVAS_WIDTH = 300
      const CANVAS_HEIGHT = 300
      const arrowcanvReference = this.$refs.arrowCanvas
      this.arrowRenderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        canvas: arrowcanvReference
      }) // clear
      this.arrowRenderer.outputColorSpace = THREE.LinearSRGBColorSpace
      this.arrowRenderer.setClearColor(0x000000, 0)
      this.arrowRenderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT)

      this.arrowScene = new THREE.Scene()

      this.arrowCamera = new THREE.PerspectiveCamera(
        50,
        CANVAS_WIDTH / CANVAS_HEIGHT,
        1,
        1000
      )
      this.arrowCamera.up = this.camera.up // important!

      const arrowPoint = new THREE.Vector3(0, 0, 0)
      const xAxis = new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        arrowPoint,
        60,
        0x7f2020,
        20,
        10
      )
      const yAxis = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        arrowPoint,
        60,
        0x20207f,
        20,
        10
      )
      const zAxis = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, -1),
        arrowPoint,
        60,
        0x207f20,
        20,
        10
      )
      this.arrowScene.add(xAxis, yAxis, zAxis)
      // this.animate()
    },

    toDegree(radians) {
      return radians * (180 / Math.PI)
    },

    toRadians(degrees) {
      return degrees * (Math.PI / 180)
    },

    drawPath: function () {
      // console.log(this.pointsPath)
      // dot material
      const dotMaterial = new THREE.PointsMaterial({
        size: 3,
        color: 0x888888,
        sizeAttenuation: false
      })

      // create list of colors
      const colors = []
      for (var i = 0; i < this.listModes.length; i++) {
        if (this.listModes[i] === 'G0') {
          colors.push(255, 0, 0, 255, 0, 0)
        } else if (this.listModes[i] === 'G1') {
          colors.push(0, 0, 255, 0, 0, 255)
        } else if (this.listModes[i] === 'G2' || this.listModes[i] === 'G3') {
          // an arc is drawn with 20 vertices (getPoints(19) below), so it needs exactly 20 vertex colors;
          // each push adds 2 vertices. A larger count shifts the colors of all following segments
          for (var k = 0; k < 10; k++) {
            colors.push(0, 0, 255, 0, 0, 255)
          }
        }
      }

      // create list of points (and for linear and circular interpolation)
      for (i = 0; i < this.pointsPath.curves.length; i++) {
        if (this.pointsPath.curves[i].type === 'LineCurve3') {
          var listPoints = this.pointsPath.curves[i].getPoints(1) // 2 point for linear interpolation
          for (var j = 0; j < listPoints.length; j++) {
            // array of points to draw
            this.linearPoints.push(listPoints[j])
            // array of points to show
            this.linearPointsToShow.push(listPoints[j])
          }
        } else {
          listPoints = this.pointsPath.curves[i].getPoints(19) // 20 points for circular interpolation
          const listPointsToShow = this.pointsPath.curves[i].getPoints(1) // 2 points to show
          for (j = 0; j < listPoints.length; j++) {
            // array of points to draw
            this.linearPoints.push(listPoints[j])
          }
          // array of points to show
          for (k = 0; k < listPointsToShow.length; k++) {
            this.linearPointsToShow.push(listPointsToShow[k])
          }
        }
      }

      // set line colors
      const geometry = new THREE.BufferGeometry().setFromPoints(
        this.linearPoints
      ) // geometry to draw
      geometry.setAttribute('color', new THREE.Uint8BufferAttribute(colors, 3))
      const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        onBeforeCompile: shader => {
          shader.vertexShader = shader.vertexShader.replace(
            '#include <color_pars_vertex>',
            'flat out vec3 vColor;'
          )
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_pars_fragment>',
            'flat in vec3 vColor;'
          )
        }
      })

      // points geometry
      const pointsGeometry = new THREE.BufferGeometry().setFromPoints(
        this.linearPointsToShow
      )

      this.linesInterpolation = new THREE.Line(geometry, material)
      this.linesInterpolation.geometry.dynamic = true
      this.linesInterpolation.geometry.attributes.position.needsUpdate = true
      this.dotsInterpolation = new THREE.Points(pointsGeometry, dotMaterial)

      if (this.hasPart && this.carvingView === 'part') {
        this.linesInterpolation.visible = false
        this.dotsInterpolation.visible = false
      }

      this.scene.add(this.linesInterpolation)
      this.scene.add(this.dotsInterpolation)
    },

    prepareCircularInterpolation: function (dataArc) {
      // plane XY
      if (this.planeMode === 'G17') {
        // console.log('RUN G17')
        // definition radius of arc
        // console.log(dataArc.R)
        // if indicated I J and K
        if (isNaN(dataArc.R)) {
          var R = Math.sqrt(
            Math.pow(dataArc.offset.x, 2) + Math.pow(dataArc.offset.z, 2)
          )
          // definition center of arc
          var centerX = dataArc.startPoint.x + dataArc.offset.x
          var centerZ = dataArc.startPoint.z + dataArc.offset.z
          // if indicated R
        } else {
          // https://stackoverflow.com/questions/36211171/finding-center-of-a-circle-given-two-points-and-radius
          // https://stackoverflow.com/questions/36211171/finding-center-of-a-circle-given-two-points-and-radius/36211304#36211304
          // https://stackoverflow.com/questions/4914098/centre-of-a-circle-that-intersects-two-points/4914148#4914148
          // https://newbedev.com/finding-center-of-a-circle-given-two-points-and-radius
          // http://www.manufacturinget.org/2011/12/cnc-g-code-g02-and-g03/
          R = dataArc.R
          const radsq = Math.pow(R, 2)
          const q = Math.sqrt(
            (dataArc.endPoint.x - dataArc.startPoint.x) *
            (dataArc.endPoint.x - dataArc.startPoint.x) +
            (dataArc.endPoint.z - dataArc.startPoint.z) *
            (dataArc.endPoint.z - dataArc.startPoint.z)
          )
          const x3 = (dataArc.startPoint.x + dataArc.endPoint.x) / 2
          const y3 = (dataArc.startPoint.z + dataArc.endPoint.z) / 2

          if (R > 0) {
            // first center point
            centerX =
              x3 +
              Math.sqrt(radsq - (q / 2) * (q / 2)) *
              ((dataArc.startPoint.z - dataArc.endPoint.z) / q)
            centerZ =
              y3 +
              Math.sqrt(radsq - (q / 2) * (q / 2)) *
              ((dataArc.endPoint.x - dataArc.startPoint.x) / q)
          } else {
            // second center point (if R < 0)
            R = Math.abs(R)
            centerX =
              x3 -
              Math.sqrt(radsq - (q / 2) * (q / 2)) *
              ((dataArc.startPoint.z - dataArc.endPoint.z) / q)
            centerZ =
              y3 -
              Math.sqrt(radsq - (q / 2) * (q / 2)) *
              ((dataArc.endPoint.x - dataArc.startPoint.x) / q)
          }
        }

        // reduced values start point
        const reducedStartPointX = dataArc.startPoint.x - centerX
        const reducedStartPointZ = dataArc.startPoint.z - centerZ
        // reduced values end point
        const reducedEndPointX = dataArc.endPoint.x - centerX
        const reducedEndPointZ = dataArc.endPoint.z - centerZ

        // for check purpose
        // reducedEndPointX = R * Math.cos(this.toRadians(360))
        // reducedEndPointZ = R * Math.sin(this.toRadians(360))

        // definition betta ==> angle between axis X(10;0) and start point clockwise
        const TAU = this.toDegree(Math.PI * 2) // TAU = 360 grad
        let det = 10 * reducedStartPointZ
        let dot = 10 * reducedStartPointX
        let betta = this.toDegree(Math.atan2(det, dot))
        // console.log(betta)
        if (betta < 0) {
          betta += TAU
        }
        // console.log(betta)

        // definition alpha ==> angle between Start point and End point
        // https://stackoverflow.com/questions/40286650/how-to-get-the-anti-clockwise-angle-between-two-2d-vectors
        det =
          reducedStartPointX * reducedEndPointZ -
          reducedStartPointZ * reducedEndPointX
        dot =
          reducedStartPointX * reducedEndPointX +
          reducedStartPointZ * reducedEndPointZ
        let alpha = this.toDegree(Math.atan2(det, dot))
        // console.log(alpha)
        if (alpha <= 0) {
          alpha += TAU
        }
        // console.log(alpha)
        const curveMassive = []
        // add to curve massive Start point
        curveMassive.push(
          new THREE.Vector3(
            dataArc.startPoint.x,
            dataArc.startPoint.y,
            dataArc.startPoint.z
          )
        )
        // loop from Angle Start point to Angle End point
        for (let k = betta; k < betta + alpha; k += 3) {
          const x = centerX + R * Math.cos(this.toRadians(k))
          const y = dataArc.startPoint.y
          const z = centerZ + R * Math.sin(this.toRadians(k))
          curveMassive.push(new THREE.Vector3(x, y, z))
        }
        // add to curve massive End point
        curveMassive.push(
          new THREE.Vector3(
            dataArc.endPoint.x,
            dataArc.endPoint.y,
            dataArc.endPoint.z
          )
        )
        const curve = new THREE.CatmullRomCurve3(
          curveMassive,
          false,
          'catmullrom',
          0
        )
        this.pointsPath.add(curve)
      } else if (this.planeMode === 'G18') {
        // console.log('RUN G18')
        console.log('G18 not supported yet')
      } else if (this.planeMode === 'G19') {
        // console.log('G19')
        console.log('G19 not supported yet')
      }
    },

    /*
    @TODO:
    @TODO check how to works this function
    */
    prepareCircularInterpolationCounterclockwise: function (dataArc) {
      // console.log(dataArc)
      if (this.planeMode === 'G17') {
        // definition radius of arc
        if (isNaN(dataArc.R)) {
          var R = Math.sqrt(
            Math.pow(dataArc.offset.x, 2) + Math.pow(dataArc.offset.z, 2)
          )
          // definition center of arc
          var centerX = dataArc.startPoint.x + dataArc.offset.x
          var centerZ = dataArc.startPoint.z + dataArc.offset.z
        } else {
          R = dataArc.R
          const radsq = Math.pow(R, 2)
          const q = Math.sqrt(
            (dataArc.endPoint.x - dataArc.startPoint.x) *
            (dataArc.endPoint.x - dataArc.startPoint.x) +
            (dataArc.endPoint.z - dataArc.startPoint.z) *
            (dataArc.endPoint.z - dataArc.startPoint.z)
          )
          const x3 = (dataArc.startPoint.x + dataArc.endPoint.x) / 2
          const y3 = (dataArc.startPoint.z + dataArc.endPoint.z) / 2

          if (R > 0) {
            centerX =
              x3 -
              Math.sqrt(radsq - (q / 2) * (q / 2)) *
              ((dataArc.startPoint.z - dataArc.endPoint.z) / q)
            centerZ =
              y3 -
              Math.sqrt(radsq - (q / 2) * (q / 2)) *
              ((dataArc.endPoint.x - dataArc.startPoint.x) / q)
          } else {
            R = Math.abs(R)
            centerX =
              x3 +
              Math.sqrt(radsq - (q / 2) * (q / 2)) *
              ((dataArc.startPoint.z - dataArc.endPoint.z) / q)
            centerZ =
              y3 +
              Math.sqrt(radsq - (q / 2) * (q / 2)) *
              ((dataArc.endPoint.x - dataArc.startPoint.x) / q)
          }
        }

        // reduced values start point
        const reducedStartPointX = dataArc.startPoint.x - centerX
        const reducedStartPointZ = dataArc.startPoint.z - centerZ
        // reduced values end point
        const reducedEndPointX = dataArc.endPoint.x - centerX
        const reducedEndPointZ = dataArc.endPoint.z - centerZ

        // for check purpose
        // reducedEndPointX = R * Math.cos(this.toRadians(360))
        // reducedEndPointZ = R * Math.sin(this.toRadians(360))

        // definition betta ==> angle between axis X(10;0) and start point counterclockwise
        const TAU = this.toDegree(Math.PI * 2) // TAU = 360 grad
        let det = 10 * reducedStartPointZ
        let dot = 10 * reducedStartPointX
        let betta = this.toDegree(Math.atan2(det, dot))
        // console.log('betta')
        // console.log(betta)
        if (betta < 0) {
          betta += TAU
        }
        // console.log(betta)

        // definition alpha ==> angle between Start point and End point
        // https://stackoverflow.com/questions/40286650/how-to-get-the-anti-clockwise-angle-between-two-2d-vectors
        det =
          reducedStartPointX * reducedEndPointZ -
          reducedStartPointZ * reducedEndPointX
        dot =
          reducedStartPointX * reducedEndPointX +
          reducedStartPointZ * reducedEndPointZ
        let alpha = this.toDegree(Math.atan2(det, dot))
        // console.log('alpha')
        // console.log(alpha)
        if (alpha >= 0) {
          alpha -= TAU
        }
        // console.log(alpha)
        const curveMassive = []
        // add to curve massive Start point
        curveMassive.push(
          new THREE.Vector3(
            dataArc.startPoint.x,
            dataArc.startPoint.y,
            dataArc.startPoint.z
          )
        )
        // loop from Angle Start point to Angle End point
        for (let k = betta; k > betta - Math.abs(alpha); k -= 3) {
          const x = centerX + R * Math.cos(this.toRadians(k))
          const y = dataArc.startPoint.y
          const z = centerZ + R * Math.sin(this.toRadians(k))
          curveMassive.push(new THREE.Vector3(x, y, z))
        }
        // add to curve massive End point
        curveMassive.push(
          new THREE.Vector3(
            dataArc.endPoint.x,
            dataArc.endPoint.y,
            dataArc.endPoint.z
          )
        )
        const curve = new THREE.CatmullRomCurve3(
          curveMassive,
          false,
          'catmullrom',
          0
        )
        // console.log(curve)
        this.pointsPath.add(curve)
      }
    },

    /**
     * Puts the coordinate numbers (in mm or inches) along the X and Y axes of the grid.
     * The mapping is the same as for the toolpath: machine X -> three x, machine Y -> three -z,
     * so the label of a point at three z is -z. Labels are sprites; their size in pixels is
     * kept constant by updateAxisLabels(), because the orthographic camera is zoomed by camera.zoom.
     */
    buildAxisLabels(unit = 'mm') {
      const inches = unit === 'in'
      const half = inches ? 14 : 400 // the grid is 800 x 800 mm, 14 in is inside of it
      const step = inches ? 2 : 50 // distance between the labels
      const mmPer = inches ? 25.4 : 1 // the scene is in mm
      this.axisUnit = unit
      this.axisLabels = new THREE.Group()

      for (let v = -half; v <= half; v += step) {
        // the origin is labeled once, below and to the left of the point
        if (v === 0) {
          this.axisLabels.add(this.makeAxisLabel('0', 0, 0, 1.15, 1.15))
          continue
        }
        // X axis: the label hangs below the axis point
        this.axisLabels.add(this.makeAxisLabel(String(v), v * mmPer, 0, 0.5, 1.15))
        // Y axis: the label is to the left of the axis point; three z = -machine Y
        this.axisLabels.add(this.makeAxisLabel(String(v), 0, -v * mmPer, 1.15, 0.5))
      }

      this.scene.add(this.axisLabels)
      this.updateAxisLabels()
    },

    // Redraws the axis labels when the G-code switches between mm and inches
    setAxisUnit(unit) {
      if (unit === this.axisUnit) return
      if (this.axisLabels) {
        this.scene.remove(this.axisLabels)
        this.axisLabels.children.forEach(sprite => {
          sprite.material.map.dispose()
          sprite.material.dispose()
        })
      }
      this.buildAxisLabels(unit)
    },

    /**
     * Creates one text sprite lying on the grid plane (y = 0) at the three.js point (x, 0, z).
     * anchorX/anchorY set which point of the sprite sits on the axis point (sprite.center),
     * so the offset from the axis stays the same in pixels at any zoom.
     */
    makeAxisLabel(text, x, z, anchorX, anchorY) {
      const canvas = document.createElement('canvas')
      canvas.width = 128
      canvas.height = 64
      const ctx = canvas.getContext('2d')
      ctx.font = 'bold 48px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      // a light outline keeps the digits readable over the grid lines and the toolpath
      ctx.lineWidth = 6
      ctx.strokeStyle = '#eaeaea'
      ctx.strokeText(text, 64, 32)
      ctx.fillStyle = '#444444'
      ctx.fillText(text, 64, 32)

      const material = new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(canvas),
        depthTest: false, // always visible, also above the 3D part
        transparent: true
      })
      const sprite = new THREE.Sprite(material)
      sprite.position.set(x, 0, z)
      sprite.center.set(anchorX, anchorY)
      sprite.renderOrder = 10
      return sprite
    },

    /**
     * Keeps the labels the same size on the screen: world units per pixel of the orthographic camera
     * depends on camera.zoom, so every sprite is rescaled to LABEL_HEIGHT_PX pixels.
     */
    updateAxisLabels() {
      if (!this.axisLabels) return
      const LABEL_HEIGHT_PX = 20
      const worldPerPixel =
        (this.camera.top - this.camera.bottom) /
        this.camera.zoom /
        this.renderer.domElement.clientHeight
      const height = LABEL_HEIGHT_PX * worldPerPixel
      // the texture is 128 x 64, so the sprite is twice as wide as it is high
      this.axisLabels.children.forEach(sprite => sprite.scale.set(height * 2, height, 1))
    },

    render: function () {
      this.controls.update()
      this.updateAxisLabels()

      this.renderer.render(this.scene, this.camera)
      this.arrowRenderer.render(this.arrowScene, this.arrowCamera)
    },

    animate: function () {
      this.id = requestAnimationFrame(this.animate)

      this.controls.update()

      this.arrowCamera.position.copy(this.camera.position)
      this.arrowCamera.position.sub(this.controls.target)
      this.arrowCamera.position.setLength(300)

      this.arrowCamera.lookAt(this.arrowScene.position)
      this.render()
    },

    async longTask(i, model) {
      // console.log(i)
      // console.log(model)
      let line = model
      if (checkUsedGcode(line)) {
        // prepare line
        line = prepareGcode(line)
        // check units, the numbers of an inch G-code are scaled to mm for the scene
        const unitSystem = checkUnitSystem(line)
        if (unitSystem) {
          this.unitScale = unitSystem === 'G20' ? 25.4 : 1
        }
        if (this.unitScale !== 1) {
          line = scaleLine(line, this.unitScale)
        }
        // check positioning system
        const positioningSystem = checkPositioningSystem(line)
        if (positioningSystem && positioningSystem !== this.positioningSystem) {
          this.positioningSystem = positioningSystem
        }
        // check g-code mode
        const gcodeMode = checkGcodeMode(line)
        if (gcodeMode && gcodeMode !== this.modalGcodeMode) {
          this.modalGcodeMode = gcodeMode
        }
        // check plane mode
        const planeMode = checkPlaneMode(line)
        if (planeMode && planeMode !== this.planeMode) {
          this.planeMode = planeMode
        }
        // if G0 or G1
        if (this.modalGcodeMode === 'G0' || this.modalGcodeMode === 'G1') {
          // console.log('work G0-G01')
          if (this.positioningSystem === 'G91') {
            var coordinates = linearInterpolationIncremental(
              line,
              this.coordinateX,
              this.coordinateY,
              this.coordinateZ
            )
          } else {
            coordinates = linearInterpolation(line)
          }

          if (
            !isNaN(coordinates.x) ||
            !isNaN(coordinates.y) ||
            !isNaN(coordinates.z)
          ) {
            // if one or more coordinates exists
            if (isNaN(coordinates.x)) {
              coordinates.x = this.coordinateX
            }
            if (isNaN(coordinates.y)) {
              coordinates.y = this.coordinateY
            }
            if (isNaN(coordinates.z)) {
              coordinates.z = this.coordinateZ
            }
            // line curve from start poin and end point
            this.tmpStartVec.set(
              this.coordinateX,
              this.coordinateY,
              this.coordinateZ
            )
            this.tmpEndVec.set(coordinates.x, coordinates.y, coordinates.z)
            const curveLine = new THREE.LineCurve3(
              this.tmpStartVec.clone(),
              this.tmpEndVec.clone()
            )
            // add line curve to point path (common path for linear and circular interpolation)
            this.pointsPath.add(curveLine)

            // write coordinate end line as current coordiante
            if (coordinates.x !== this.coordinateX && !isNaN(coordinates.x)) {
              this.coordinateX = coordinates.x
            }
            if (coordinates.y !== this.coordinateY && !isNaN(coordinates.y)) {
              this.coordinateY = coordinates.y
            }
            if (coordinates.z !== this.coordinateZ && !isNaN(coordinates.z)) {
              this.coordinateZ = coordinates.z
            }

            // add mode to Dictonary listModes
            this.listModes.push(this.modalGcodeMode)
          }
          // if G02 or G03
        } else if (
          this.modalGcodeMode === 'G2' ||
          this.modalGcodeMode === 'G3'
        ) {
          // console.log('work G02 G03')
          const dataArc = circularInterpolation(
            line,
            this.coordinateX,
            this.coordinateY,
            this.coordinateZ,
            this.planeMode
          )
          // function, that get data about arc and create CatmullRomCurve3 for push to pointsPath
          if (this.modalGcodeMode === 'G2') {
            this.prepareCircularInterpolation(dataArc)
          } else if (this.modalGcodeMode === 'G3') {
            this.prepareCircularInterpolationCounterclockwise(dataArc)
          }
          // write endPoint coordinate as current coordinate
          this.coordinateX = dataArc.endPoint.x
          this.coordinateY = dataArc.endPoint.y
          this.coordinateZ = dataArc.endPoint.z
          // add mode to Dictonary listModes
          this.listModes.push(this.modalGcodeMode)
        }
      }
    },

    async editorRun() {
      if (this.isLongGcode) {
        this.dialogp = true
      }

      this.progress = 0
      let processed = 0

      const progressTimer = setInterval(() => {
        this.progress = Math.ceil((processed / lineCount) * 100)
      }, 200) // one in 100 ms

      const lines = this.gcodeSource.split('\n')
      // console.log(lines)
      this.pointsPath = new THREE.CurvePath()
      this.unitScale = 1
      const promises = []
      const lineCount = lines.length
      for (let i = 1; i <= lineCount; i++) {
        promises.push(this.longTask(i, lines[i]))
        processed++
        if (lineCount > 100000 && !(i % 100000)) {
          await new Promise(resolve => setTimeout(resolve, 1))
        } else if (lineCount > 10000 && lineCount <= 100000 && !(i % 10000)) {
          await new Promise(resolve => setTimeout(resolve, 1))
        }
      }
      await Promise.all(promises)
      this.setAxisUnit(this.unitScale === 1 ? 'mm' : 'in')
      clearInterval(progressTimer)
      this.progress = 100
      this.dialogp = false
      // console.log(this.pointsPath)
      this.drawPath()
    },

    frontView: function () {
      this.camera.position.x = 0
      this.camera.position.y = 500
      this.camera.position.z = 0
      this.controls.target.set(0, 0, 0)
      this.controls.update()
    },

    topView: function () {
      this.camera.position.x = 0
      this.camera.position.y = 0
      this.camera.position.z = 500
      this.controls.target.set(0, 0, 0)
      this.controls.update()
    },

    isometricView: function () {
      this.camera.position.x = 500
      this.camera.position.y = 500
      this.camera.position.z = 500
      this.controls.target.set(0, 0, 0)
      this.controls.update()
    }
  }
}
</script>

<style>
#arrowCanvas {
  position: absolute;
  z-index: 80;
  bottom: 46px;
  left: -80px;
}

.arrow-legenda {
  position: relative;
  width: 20px;
  bottom: 160px;
  left: 160px;
  z-index: 80;
  font-size: 20px;
}

.view-buttons {
  position: relative;
  z-index: 80;
  margin-left: 22px;
  margin-top: -60px;
}

.coordinate-legendX {
  color: #7f2020;
}

.coordinate-legendY {
  color: #207f20;
}

.coordinate-legendZ {
  color: #20207f;
}

.canvas-container {
  margin-top: 20px;
}

.v-btn__content img {
  width: 30px;
  height: 30px;
}
</style>
