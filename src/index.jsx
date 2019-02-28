import xs from 'xstream'
import { run } from '@cycle/run'
import { makeDOMDriver } from '@cycle/react-dom'
import { makeHTTPDriver } from '@cycle/http'
import { withState } from '@cycle/state'
import { useState } from 'react'
import { h, makeComponent } from '@cycle/react'

import { cycleReactComponent as component } from './vdom-stream-component.js'

/** @jsx pragma */
// const pragma = React.createElement
const pragma = (node, attr, ...children) =>
  h(node, attr || {}, children)

function ExampleReactComponent () {
  const [option, setOption] = useState('option2')

  return (
    <div>
      <h3 className='uk-card-title'>React Component:</h3>
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
    react: xs.of(1000)
      .map(counter =>
        <div>This is a timer: {counter}</div>
      )
  }
}

function Counter (sources) {
  const inc = Symbol()
  const inc$ = sources.react.select(inc).events('click')

  const count$ = inc$.fold(count => count + 1, 0)

  const vdom$ = count$.map(i =>
    <div>
      <h1>Counter: {i}</h1>
      <button sel={inc}>Incremenet</button>
    </div>
  )

  return {
    react: vdom$
  }
}

function Combobox (sources) {
  const select = Symbol()
  const state$ = sources.state.stream

  const reducer$ =
    sources.react
      .select(select)
      .events('change')
      .map(event => event.target.value)
      .map(value => state => ({ ...state, comboValue: value }))

  return {
    react: state$.map(state => {
      return (
        <div key='6'>
          <h3 className='uk-card-title'>Cycle JS component:</h3>
          <div key='3'>This is a combobox: {state.comboValue}</div>
          <select sel={select} key='4' defaultValue={state.comboValue}>
            <option key='1'>option1</option>
            <option key='2'>option2</option>
          </select>
        </div>
      )
    }),
    state: reducer$,
    HTTP: xs.of({
      url: '?example-http-request',
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
    <div className='uk-margin-left uk-width-1-5 uk-padding-small uk-card uk-card-default uk-card-body uk-card-primary'>
      {sources.props.children}
    </div>
  )
}

function main (sources) {
  const state$ = sources.state.stream

  const initReducer$ = xs.of(prevState =>
    ({ comboValue: 'option2' })
  )

  const reducer$ = xs.merge(initReducer$)

  return component(sources,
    <div key='x' className='uk-padding-small uk-flex'>
      <Card>
        <Combobox />
      </Card>
      <Card>
        <ReactComponentWrapper>
          <ExampleReactComponent />
        </ReactComponentWrapper>
      </Card>
      <Card>
        <Timer />
      </Card>
      <Card>
        <Counter />
      </Card>
      <Card>
        <Counter />
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
