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
      <select value={option} onChange={e => { setOption(e.target.value) }}>
        <option>option1</option>
        <option>option2</option>
      </select>
      <div>state.comboValue: {option}</div>
    </div>
  )
}

function ReactComponentWrapper (sources) {
  return {
    react: xs.of(sources.props.children)
  }
}

function Timer () {
  return {
    react: xs.periodic(1000).startWith(-1)
      .map(counter => <div>{counter}</div>)
  }
}

function Counter (sources) {
  const inc = Symbol()
  const inc$ = sources.react.select(inc).events('click')

  const count$ = inc$.fold(count => count + 1, 0)

  return component(sources,
    <div>
      <button sel={inc}>Incremenet</button>
      <div>{count$}</div>
    </div>
  )
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

  const comboValue$ = state$.map(s => s.comboValue)

  return component(sources,
    <div>
      <div>Color:</div>
      <select sel={select} defaultValue={comboValue$}>
        <option value='#1e87f0'>auto</option>
        <option value='red'>red</option>
        <option value='purple'>puple</option>
      </select>
      <div>state.comboValue: {comboValue$}</div>
    </div>,
    {
      state: reducer$,
      HTTP: xs.of({
        url: '?example-http-request',
        category: 'search'
      })
    }
  )
}

function Card (sources) {
  return component(sources,
    <div
      className='uk-margin-right uk-width-1-6 uk-padding-small uk-card uk-card-default uk-card-body uk-card-primary'
      style={sources.props.style}
    >
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

  const reducer$ = xs.of(() => ({ comboValue: 'red' }))

  return component(sources,
    <div className='uk-padding-small'>
      <div className='uk-flex uk-margin'>
        <Card title='Cycle JS component'>
          <Combobox />
        </Card>
        <Card title='React Component'>
          <ReactComponentWrapper>
            <ReactComponent />
          </ReactComponentWrapper>
        </Card>
        <Card title='Timer'>
          <Timer />
        </Card>
        <Card title='Counter'>
          <Counter />
        </Card>
        <Card title='Another counter'>
          <Counter />
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
        <Card title={state$.map(state => `Stream travelling through prop: ${state.comboValue}`)} />
        <Card title='Stream DOM prop' style={{ background: state$.map(state => state.comboValue) }}>
          {'style={{ background: \''}
          {state$.map(state => state.comboValue)}
          {'\' }}'}
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
