const re1 = /(%.*)|({.*)|((?:\$\$)|(?:\$[a-zA-Z0-9#]*))|([a-zA-Z][0-9+\-.]+)|(\*[0-9]+)/i
const reG = /G[0-9]+/i
const reX = /X[-.0-9]+/i
const reY = /Y[-.0-9]+/i
const reZ = /Z[-.0-9]+/i

function checkUsedGcode (line) {
  return re1.test(line) && (
    reG.test(line) ||
    reX.test(line) ||
    reY.test(line) ||
    reZ.test(line)
  )
}

// removes comments in brackets, individually
const parenCommentRE = /\(.*?\)/g
// removes ; and everything after, including spaces before
const semicolonCommentRE = /\s*;.*$/g
// removes all whitespace characters
const whitespaceRE = /\s+/g

function prepareGcode (line) {
  return line
    .replace(parenCommentRE, '')
    .replace(semicolonCommentRE, '')
    .replace(whitespaceRE, '')
    .toUpperCase()
}

/**
parse line and seek G00-G03 code
@return {modalGcodeMode or false}
**/
const reG0 = /G0(?!\d)|G00/i
const reG1 = /G1(?!\d)|G01/i
const reG2 = /G2(?!\d)|G02/i
const reG3 = /G3(?!\d)|G03/i

function checkGcodeMode (line) {
  if (reG0.test(line)) {
    // console.log('rapid move')
    return 'G0'
  } else if (reG1.test(line)) {
    // console.log('linear interpolation')
    return 'G1'
  } else if (reG2.test(line)) {
    console.log('circular interpolation clockwise')
    return 'G2'
  } else if (reG3.test(line)) {
    console.log('circular interpolation counterclockwise')
    return 'G3'
  }
  return false
}

/**
check plane G17 G18 G19
@return {planeMode or false}
**/
function checkPlaneMode (line) {
  let planeMode = false
  if (/G17/.test(line)) {
    planeMode = 'G17'
  } else if (/G18/.test(line)) {
    planeMode = 'G18'
  } else if (/G19/.test(line)) {
    planeMode = 'G19'
  }
  return planeMode
}

/**
check plane G90 G91
@return {positioningSystem or false}
**/
function checkPositioningSystem (line) {
  let positioningSystem = false
  if (/G90/.test(line)) {
    positioningSystem = 'G90'
  } else if (/G91/.test(line)) {
    positioningSystem = 'G91'
  }
  return positioningSystem
}

/**
parse line and seek X,Y,Z linear interpolation
@return {x, y, z}
**/
const reXLinear = /X[-+]?\d*\.?\d+/
const reYLinear = /Y[-+]?\d*\.?\d+/
const reZLinear = /Z[-+]?\d*\.?\d+/

function linearInterpolation (line) {
  const matchX = reXLinear.exec(line)
  const matchY = reYLinear.exec(line)
  const matchZ = reZLinear.exec(line)

  const x = matchX ? Number(matchX[0].slice(1)) : NaN
  const y = matchZ ? Number(matchZ[0].slice(1)) : NaN
  const z = matchY ? -Number(matchY[0].slice(1)) : NaN

  return { x, y, z }
}

const reXIncremental = /X[-+]?\d*\.?\d+/
const reYIncremental = /Y[-+]?\d*\.?\d+/
const reZIncremental = /Z[-+]?\d*\.?\d+/

function linearInterpolationIncremental (line, currentX, currentY, currentZ) {
  const matchX = reXIncremental.exec(line)
  const matchY = reYIncremental.exec(line)
  const matchZ = reZIncremental.exec(line)

  const x = (matchX ? Number(matchX[0].slice(1)) : 0) + currentX
  const y = (matchZ ? Number(matchZ[0].slice(1)) : 0) + currentY
  const z = (matchY ? -Number(matchY[0].slice(1)) : 0) + currentZ

  return { x, y, z }
}

/**
parse line and seek X,Y,Z circular interpolation
@return {
  offset => offset in case I, J, K
  R => radius
  startPoint => start point Arc (end point previous line)
  endPoint => end point Arc
}
**/
function circularInterpolation (line, currentX, currentY, currentZ, planeMode) {
  var CoordinateXEndPoint = NaN
  var CoordinateYEndPoint = NaN
  var CoordinateZEndPoint = NaN
  if (/X[-.0-9]+/g.test(line)) {
    const xEndPoint = line.match(/X[-.0-9]+/g)[0]
    CoordinateXEndPoint = xEndPoint.substring(1)
  }
  if (/Y[-.0-9]+/g.test(line)) {
    const yEndPoint = line.match(/Y[-.0-9]+/g)[0]
    CoordinateYEndPoint = yEndPoint.substring(1)
  }
  if (/Z[-.0-9]+/g.test(line)) {
    const zEndPoint = line.match(/Z[-.0-9]+/g)[0]
    CoordinateZEndPoint = zEndPoint.substring(1)
  }

  var offsetI = NaN
  var offsetJ = NaN
  var offsetK = NaN
  var valueR = NaN
  if (/I[-.0-9]+/g.test(line)) {
    const iOffset = line.match(/I[-.0-9]+/g)[0]
    offsetI = iOffset.substring(1)
  }
  if (/J[-.0-9]+/g.test(line)) {
    const jOffset = line.match(/J[-.0-9]+/g)[0]
    offsetJ = jOffset.substring(1)
  }
  if (/K[-.0-9]+/g.test(line)) {
    const kOffset = line.match(/K[-.0-9]+/g)[0]
    offsetK = kOffset.substring(1)
  }
  if (/R[-.0-9]+/g.test(line)) {
    const R = line.match(/R[-.0-9]+/g)[0]
    valueR = R.substring(1)
  }
  // console.log('here R')
  // console.log(valueR)
  if (planeMode === 'G17') {
    var dict = {
      offset: {
        x: Number(offsetI),
        z: Number(-offsetJ)
      },
      R: valueR,
      startPoint: {
        x: Number(currentX),
        y: Number(currentY),
        z: Number(currentZ)
      },
      endPoint: {
        x: Number(CoordinateXEndPoint),
        y: Number(currentY),
        z: Number(-CoordinateYEndPoint)
      }
    }
  } else if (planeMode === 'G18') {
    dict = {
      offset: {
        x: Number(offsetI),
        y: Number(offsetK)
      },
      R: valueR,
      startPoint: {
        x: Number(currentX),
        y: Number(currentY),
        z: Number(currentZ)
      },
      endPoint: {
        x: Number(CoordinateXEndPoint),
        y: Number(CoordinateZEndPoint),
        z: Number(currentZ)
      }
    }
  } else if (planeMode === 'G19') {
    dict = {
      offset: {
        z: Number(-offsetJ),
        y: Number(offsetK)
      },
      R: valueR,
      startPoint: {
        x: Number(currentX),
        y: Number(currentY),
        z: Number(currentZ)
      },
      endPoint: {
        x: Number(currentX),
        z: Number(-CoordinateYEndPoint),
        y: Number(CoordinateZEndPoint)
      }
    }
  }
  return dict
}

export {
  checkGcodeMode,
  linearInterpolation,
  circularInterpolation,
  prepareGcode,
  checkUsedGcode,
  checkPlaneMode,
  checkPositioningSystem,
  linearInterpolationIncremental
}
