import xs from 'xstream'
import { run } from '@cycle/run'
import { makeDOMDriver } from '@cycle/react-dom'
import { makeHTTPDriver } from '@cycle/http'
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
    <div>
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

function Timer () {
  return {
    react: xs.periodic(1000)
      .map(counter =>
        <div>This is a timer: {counter}</div>
      )
  }
}

function Combobox () {
  return {
    react: xs.of(
      <div>
        <div key='3'>This is a combobox</div>
        <select key='4'>
          <option key='1'>option1</option>
          <option key='2'>option2</option>
        </select>
      </div>
    ),
    HTTP: xs.of({
      url: '?mivan',
      category: 'search'
    })
  }
}

function ReactComponentWrapper (sources) {
  return {
    react: xs.of(sources.props.children)
  }
}

function Card (sources) {
  return component(sources,
    <div className='uk-margin uk-padding-small uk-card-body uk-card-primary'>
      {sources.props.children}
    </div>
  )
}

function main (sources) {
  const state$ = sources.state.stream

  const initReducer$ = xs.of(prevState =>
    ({ comboValue: 'option1' })
  )

  const reducer$ = xs.merge(initReducer$)

  return component(sources,
    <div className='uk-padding-small uk-width-1-4@m'>
      <Card>
        <ReactComponentWrapper>
          <ExampleReactComponent />
        </ReactComponentWrapper>
      </Card>
      <Card>
        <Timer />
      </Card>
      <Card>
        <Combobox />
      </Card>
    </div>,
    {
      state: reducer$
    }
  )
}

const drivers = {
  react: makeDOMDriver(document.getElementById('app')),
  HTTP: makeHTTPDriver()
}

run(withState(main), drivers)
