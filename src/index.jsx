import xs from 'xstream'
import { run } from '@cycle/run'
import { makeDOMDriver } from '@cycle/react-dom'
import { makeHTTPDriver } from '@cycle/http'
import { withState } from '@cycle/state'
import { useState } from 'react'

import { pragma, component, ReactComponentWrapper } from './powercycle/react/component.js'
/** @jsx pragma */

function ReactComponent () {
  const [count, setCount] = useState(0)

  return (
    <div>
      <div>Counter: {count}</div>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  )
}

function ReactComponentWithCycleState () {
  const [option, setOption] = useState('option2')

  return (
    <div>
      <div>Color:</div>
      <select value={option} onChange={e => { setOption(e.target.value) }}>
        <option value='#1e87f0'>default</option>
        <option value='red'>red</option>
        <option value='purple'>puple</option>
        <option value='green'>green</option>
      </select>
      <div>state.comboValue: {'comboValue$'}</div>
    </div>
  )
}

function Timer () {
  return {
    react: xs.periodic(1000).startWith(-1)
      .map(counter => <div>{counter}</div>)
  }
}

function Counter (sources) {
  const inc = Symbol('inc')
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
  const select = Symbol('select')
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
        <option value='#1e87f0'>default</option>
        <option value='red'>red</option>
        <option value='purple'>puple</option>
        <option value='green'>green</option>
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
  return component(sources,
    <div>{sources.state.stream.map(state => state.comboValue)}</div>
  )
}

function main (sources) {
  const state$ = sources.state.stream

  const reducer$ = xs.of(() => ({ comboValue: 'red' }))

  const color$ = state$.map(state => state.comboValue)

  return component(sources,
    <div className='uk-padding-small'>
      <div className='uk-flex uk-margin'>

        <Card title='Cycle JS component'>
          <Combobox />
        </Card>

        <Card title='React component'>
          <ReactComponentWrapper>
            <ReactComponent />
          </ReactComponentWrapper>
        </Card>

        <Card title='React cmp w/ Cycle state'>
          <ReactComponentWrapper>
            <ReactComponentWithCycleState />
          </ReactComponentWrapper>
        </Card>

        <Card title='Timer'>
          <Timer />
        </Card>

        <Card title='Counter'>
          <Counter />
        </Card>

      </div>
      <div className='uk-flex'>

        <Card title='Another counter'>
          <Counter />
        </Card>

        <Card title='Get state in nested component'>
          <ShowState />
        </Card>

        <Card title='Stream text node'>
          Combobox value:&nbsp;
          {state$.map(state => state.comboValue)}
        </Card>

        <Card title={color$.map(color => `Stream travelling through prop: ${color}`)} />

        <Card title='Stream DOM prop' style={{ background: color$ }}>
          &lt;... style={'{{'} background: color$ {}}}...&gt;
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
