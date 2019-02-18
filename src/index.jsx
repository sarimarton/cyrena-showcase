import xs from 'xstream'
import { run } from '@cycle/run'
import { h } from '@cycle/react'
import { makeDOMDriver } from '@cycle/react-dom'
import React, { useState } from 'react'
import ReactDOM from 'react-dom'


/** @jsx pragma */
function pragma (node, attr, ...children) {
  const json = React.createElement(node, attr, ...children)
  // console.log(json)
  return json
}

function ExampleReactComponent (props) {
  const [count, setCount] = useState(0)

  return (
    <button onClick={() => setCount(count + 1)}>
      Click me ({count})
    </button>
  )
}

function main (sources) {
  // const inc = Symbol();
  // const inc$ = sources.react.select(inc).events('click');
  //
  // const count$ = inc$.fold(count => count + 1, 0);
  //
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
