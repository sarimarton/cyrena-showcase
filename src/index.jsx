import xs from 'xstream'
import { run } from '@cycle/run'
import { makeDOMDriver } from '@cycle/react-dom'
import { makeHTTPDriver } from '@cycle/http'
import { withState } from '@cycle/state'
import { useState } from 'react'
import { h } from '@cycle/react'

import { cycleReactComponent as component } from './vdom-stream-component.js'

/** @jsx pragma */
// const pragma = React.createElement
const pragma = (node, attr, ...children) =>
  h(node, attr || {}, children)

function ReactComponent () {
  const [option, setOption] = useState('option2')

  return (
    <div>
      <h3 className='uk-card-title'>React Component</h3>
      <select value={option} onChange={e => { setOption(e.target.value) }}>
        <option>option1</option>
        <option>option2</option>
      </select>
      <div>state.comboValue: {option}</div>
    </div>
  )
}

function Timer () {
  return {
    react: xs.periodic(1000).startWith(-1)
      .map(counter =>
        <div>
          <h3 className='uk-card-title'>Timer</h3>
          <div>{counter}</div>
        </div>
      )
  }
}

function Counter (sources) {
  const inc = Symbol()
  const inc$ = sources.react.select(inc).events('click')

  const count$ = inc$.fold(count => count + 1, 0)

  const vdom$ = count$.map(i =>
    <div>
      <h3 className='uk-card-title'>{sources.props.title || 'Counter'}</h3>
      <button sel={inc}>Incremenet</button>
      <div>{i}</div>
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
        <div>
          <h3 className='uk-card-title'>Cycle JS component</h3>
          <select sel={select} defaultValue={state.comboValue}>
            <option>option1</option>
            <option>option2</option>
          </select>
          <div>state.comboValue: {state.comboValue}</div>
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
    <div className='uk-margin-right uk-width-1-6 uk-padding-small uk-card uk-card-default uk-card-body uk-card-primary'>
      {sources.props.title &&
        <h3 className='uk-card-title'>{sources.props.title}</h3>}
      {sources.props.children}
    </div>
  )
}

function ShowState (sources) {
  return {
    react: sources.state.stream.map(state => <div>{state.comboValue}</div>)
  }
}

function main (sources) {
  const state$ = sources.state.stream

  const reducer$ = xs.of(() => ({ comboValue: 'option2' }))

  return component(sources,
    <div className='uk-padding-small'>
      <div className='uk-flex uk-margin'>
        <Card>
          <Combobox />
        </Card>
        <Card>
          <ReactComponentWrapper>
            <ReactComponent />
          </ReactComponentWrapper>
        </Card>
        <Card>
          <Timer />
        </Card>
        <Card>
          <Counter title='Counter' />
        </Card>
        <Card>
          <Counter title='Another counter' />
        </Card>
      </div>
      <div className='uk-flex'>
        <Card title='Get state in nested component'>
          <ShowState />
        </Card>
        <Card title='Stream text node'>
          Combobox value:&nbsp;
          {state$.map(state => state.comboValue)}
        </Card>
        <Card title={state$.map(state => `Stream prop: ${state.comboValue}`)} />
        <Card title='Stream prop on DOM prop'>
        </Card>
      </div>
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
