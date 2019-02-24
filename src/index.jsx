import xs from 'xstream'
import { run } from '@cycle/run'
import { makeDOMDriver } from '@cycle/react-dom'
import { withState } from '@cycle/state'
import React, { useState } from 'react'

import { cycleReactComponent as component } from './vdom-stream-component.js'

/** @jsx pragma */
function pragma (node, attr, ...children) {
  const json = React.createElement(node, attr, ...children)
  // console.log(json)
  return json
}

function ExampleReactComponent () {
  const [option, setOption] = useState('option2')

  return (
    <div className='uk-card uk-card-primary uk-card-body uk-width-1-4@m'>
      <h3 className='uk-card-title'>Example React Component:</h3>
      <select value={option} onChange={e => { setOption(e.target.value) }}>
        <option>option1</option>
        <option>option2</option>
      </select>
      <div>value: {option}</div>
      <div>Cycle JS component value: {}</div>
    </div>
  )
}

function Combobox () {
  return {
    react: xs.of(<div>combobox</div>)
  }
}

function main (sources) {
  // const vdom$ = xs.periodic(2000)
  //   .map(counter =>
  //     <div className='uk-padding'>
  //       <ExampleReactComponent counter={counter} />
  //
  //       <h3>Cycle JS Counter: {counter}</h3>
  //     </div>
  //   )
  //
  // return {
  //   react: vdom$,
  //   state: reducer$
  // }

  return component(
    <div className='card'>
      <Combobox />
      <div>
        <div>mivan</div>
        <Combobox />
      </div>
    </div>
  )
}

const drivers = {
  react: makeDOMDriver(document.getElementById('app'))
}

run((main), drivers)
