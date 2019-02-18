import xs from 'xstream'
import { run } from '@cycle/run'
import { makeDOMDriver } from '@cycle/react-dom'
import React, { useState } from 'react'


/** @jsx pragma */
function pragma (node, attr, ...children) {
  const json = React.createElement(node, attr, ...children)
  // console.log(json)
  return json
}

function ExampleReactComponent () {
  const [count, setCount] = useState(0)

  return (
    <button onClick={() => setCount(count + 1)}>
      Click me ({count})
    </button>
  )
}

function main (sources) {
  const vdom$ = xs.periodic(2000).map(i =>
    <>
      <h3>Example React Component:</h3>
      <ExampleReactComponent />

      <h3>Cycle JS Counter: {i}</h3>
    </>
  )

  return {
    react: vdom$
  }
}

const drivers = {
  react: makeDOMDriver(document.getElementById('app'))
}

run(main, drivers)
