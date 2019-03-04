import xs from 'xstream'
import { run } from '@cycle/run'
import { makeDOMDriver } from '@cycle/react-dom'
import { makeHTTPDriver } from '@cycle/http'
import { withState } from '@cycle/state'
import { Fragment, useState } from 'react'

import { pragma, component, ReactDomain, useCycleState } from './powercycle/react/component.js'
/** @jsx pragma */
/** @jsxFrag Fragment */

function ReactComponent (props, state) {
  const [count, setCount] = useState(0)

  return (
    <div style={props.style}>
      <div>Counter: {count}</div>
      <div><button onClick={() => setCount(count + 1)}>Increment</button></div>
    </div>
  )
}

function ReactComponentWithCycleState (props) {
  const [state, setState] = useCycleState(props.sources)

  return (
    <>
      <div>Color:</div>
      <select value={state.comboValue} onChange={e => { setState({ comboValue: e.target.value }) }}>
        <option value='#1e87f0'>default</option>
        <option value='red'>red</option>
        <option value='purple'>puple</option>
        <option value='green'>green</option>
      </select>
      <div>state.comboValue: {state.comboValue}</div>
    </>
  )
}

function Timer () {
  return component(null,
    <div>{xs.periodic(1000).startWith(-1)}</div>
  )
}

function Counter (sources) {
  const inc = Symbol('inc')
  const inc$ = sources.react.select(inc).events('click')

  const count$ = inc$.fold(count => count + 1, 0)

  return component(sources,
    <>
      <button sel={inc}>Incremenet</button>
      <div>{count$}</div>
    </>
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
    <>
      <div>Color:</div>
      <select sel={select} defaultValue={comboValue$}>
        <option value='#1e87f0'>default</option>
        <option value='red'>red</option>
        <option value='purple'>puple</option>
        <option value='green'>green</option>
      </select>
      <div>state.comboValue: {comboValue$}</div>
    </>,
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
      className='uk-margin-right uk-width-1-5 uk-padding-small uk-card uk-card-default uk-card-body uk-card-primary'
      style={sources.props.style}
    >
      {sources.props.title &&
        <h3 className='uk-card-title'>{sources.props.title}</h3>}
      <div>{sources.props.children}</div>
    </div>
  )
}

function ShowState (sources) {
  return component(sources,
    <div>state.comboValue: {sources.state.stream.map(state => state.comboValue)}</div>
  )
}

function Code (sources) {
  return component(sources,
    <span className='uk-text-small' style={{ fontSize: 12, fontFamily: 'consolas, monospace' }}>
      {sources.props.children}
    </span>
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

        <Card title='React domain'>
          <ReactDomain>
            <ReactComponent style={{ width: '90px', float: 'left' }} />
            <ReactComponent style={{ width: '90px', float: 'left' }} />
            text node
          </ReactDomain>
        </Card>

        <Card title='React cmp w/ Cycle state'>
          <ReactDomain>
            <ReactComponentWithCycleState />
          </ReactDomain>
        </Card>

        <Card title='Timer'>
          <Timer />
        </Card>

      </div>
      <div className='uk-flex uk-margin'>

        <Card title='Get state in nested component'>
          <ShowState />
        </Card>

        <Card title='Counter'>
          <Counter />
        </Card>

        <Card title='Another counter'>
          <Counter />
        </Card>

        <Card title='Stream text node'>
          Combobox value:&nbsp;
          {color$}
          <br />
          <Code>
            {'<div>{color$}</div>'}
          </Code>
        </Card>

      </div>

      <div className='uk-flex uk-margin'>
        <Card title={color$.map(color => `Stream travelling through prop: ${color}`)} />

        <Card title='Stream DOM prop' style={{ background: color$ }}>
          <Code>
            &lt;div style={'{{'} background: color$ {}}}&gt;
          </Code>
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
