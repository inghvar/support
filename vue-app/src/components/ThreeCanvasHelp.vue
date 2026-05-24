<template>
  <div class="canvas-container">
    <canvas class="div-canvas" ref="commonCanvas"></canvas>
    <canvas class="div-canvas" id="arrowCanvas" ref="arrowCanvas"></canvas>

    <div class="view-buttons">
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
  linearInterpolationIncremental
} from '../assets/js/gcodeParse'

import TopIcon from './TopIcon.vue'
import FrontIcon from './FrontIcon.vue'
import IsometricIcon from './IsometricIcon.vue'

export default {
  name: 'ThreeCanvasHelp',
  props: {
    gcodeSource: {
      required: true
    }
  },
  components: {
    TopIcon,
    FrontIcon,
    IsometricIcon
  },
  data() {
    return {
      progress: null,
      dialogp: false,
      isLongGcode: false,

      coordinateX: 0,
      coordinateY: 0,
      coordinateZ: 0
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

    this.tmpStartVec = null
    this.tmpEndVec = null

    this.initThree()
    if (this.isLongGcode) {
      this.dialogp = true
    }
    this.animate()
    this.editorRun()
  },
  methods: {
    initThree() {
      // console.log(gcodeText)
      // vector for loops
      this.tmpStartVec = new THREE.Vector3()
      this.tmpEndVec = new THREE.Vector3()

      const canvReference = this.$refs.commonCanvas
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        canvas: canvReference
      })
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

      // ---------------------- inset arrow canvas ----------------------

      const CANVAS_WIDTH = 300
      const CANVAS_HEIGHT = 300
      const arrowcanvReference = this.$refs.arrowCanvas
      this.arrowRenderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        canvas: arrowcanvReference
      }) // clear
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
          for (var k = 0; k <= 20; k++) {
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

    render: function () {
      this.controls.update()

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
