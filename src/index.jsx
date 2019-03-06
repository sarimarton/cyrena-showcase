import xs from 'xstream'
import { run } from '@cycle/run'
import { makeDOMDriver } from '@cycle/react-dom'
import { withState } from '@cycle/state'
import { Fragment, useState } from 'react'

import './style.css'

import {
  pragma,
  withPower,
  ReactRealm,
  Scope,
  useCycleState,
  Collection,
  get,
  map,
  component
} from 'powercycle'

/** @jsx pragma */
/** @jsxFrag Fragment */

function ReactCounter (props, state) {
  const [count, setCount] = useState(0)

  return (
    <div style={props.style}>
      <div>Counter: {count}</div>
      <div><button onClick={() => setCount(count + 1)}>Increment</button></div>
    </div>
  )
}

function ReactComboboxWithCycleState (props) {
  const [state, setState] = useCycleState(props.sources)

  return (
    <>
      <label>Color: </label>
      <select value={state.color} onChange={e => { setState({ ...state, color: e.target.value }) }}>
        <option value='#1e87f0'>default</option>
        <option value='red'>red</option>
        <option value='purple'>purple</option>
        <option value='green'>green</option>
      </select>
    </>
  )
}

function ReactComponentWithCycleStateAndLens (props) {
  const [state, setState] = useCycleState(props.sources)

  return (
    <>
      <label>Color: </label>
      <select value={state} onChange={e => { setState(e.target.value) }}>
        <option value='#1e87f0'>default</option>
        <option value='red'>red</option>
        <option value='purple'>purple</option>
        <option value='green'>green</option>
      </select>
    </>
  )
}

function Counter (sources) {
  const inc = Symbol(0)
  const inc$ = sources.react.select(inc).events('click')

  const count$ = inc$.fold(count => count + 1, 0)

  return (
    <>
      {count$}<br />
      <button sel={inc}>Incremenet</button>
    </>
  )
}

function Combobox (sources) {
  const select = Symbol(0)
  const state$ = sources.state.stream

  const reducer$ =
    sources.react
      .select(select)
      .events('change')
      .map(event => event.target.value)
      .map(value => prevState => ({ ...prevState, color: value }))

  const color$ = state$.map(s => s.color)

  return [
    <>
      <label>Color: </label>
      <select sel={select} defaultValue={color$}>
        <option value='#1e87f0'>default</option>
        <option value='red'>red</option>
        <option value='purple'>purple</option>
        <option value='green'>green</option>
      </select>
    </>,
    { state: reducer$ }
  ]
}

function ComboboxWithLens (sources) {
  const select = Symbol(0)
  const state$ = sources.state.stream

  const reducer$ =
    sources.react
      .select(select)
      .events('change')
      .map(event => event.target.value)
      .map(value => prevState => value)

  return [
    <>
      <label>Color: </label>
      <select sel={select} defaultValue={state$}>
        <option value='#1e87f0'>default</option>
        <option value='red'>red</option>
        <option value='purple'>purple</option>
        <option value='green'>green</option>
      </select>
    </>,
    { state: reducer$ }
  ]
}

function Card (sources) {
  return (
    <div
      className='uk-card uk-card-default uk-padding-small uk-card-primary'
      style={{ ...sources.props.style }}
    >
      {sources.props.title &&
        <h5>{sources.props.title}</h5>}
      <div>{sources.props.children}</div>
    </div>
  )
}

function ShowState (sources) {
  // return {
  //   react: sources.state.stream.map(state => <Code>{JSON.stringify(state)}</Code>)
  // }
  //
  // return component(
  //   <Code>{sources.state.stream.map(state => JSON.stringify(state))}</Code>,
  //   { /* event sinks */ },
  //   sources
  // )
  //
  // return [
  //   <Code>{sources.state.stream.map(state => JSON.stringify(state))}</Code>,
  //   { /* other sinks */ }
  // ]
  //
  // return (
  //   <Code>{sources.state.stream.map(state => JSON.stringify(state))}</Code>
  // )
  //
  // return (
  //   <Code>{map(JSON.stringify, sources)}</Code>
  // )

  return (
    <Code>{map(JSON.stringify)}</Code>
  )
}

function Code (sources) {
  return (
    <span className='uk-text-small' style={{ fontSize: 12, fontFamily: 'consolas, monospace' }}>
      {sources.props.children}
    </span>
  )
}

function CollectionDemo (sources) {
  const add = Symbol(0)

  const add$ = sources.react.select(add).events('click')
    .map(event => prevState => ([...prevState, { color: '#1e87f0' }]))

  return [
    <>
      <div>
        <button sel={add}>Add</button>
      </div>
      <br />
      <div>
        <Collection indexKey='idx'>
          <pre>
            {/* Different ways to get state key */}
            (
            {src => <>{src.state.stream.map(s => s.idx)}</>}
            ,
            {map(s => s.idx)}
            ,
            {get('idx')}
            ,
            <Scope lens='idx'>{get()}</Scope>
            )&nbsp;

            <Combobox />

            {src => {
              const remove = Symbol(0)

              return [
                <button sel={remove} style={{ float: 'right' }}>Remove</button>,
                { state: src.react.select(remove).events('click')
                  .map(event => prevState => undefined) }
                // soon:
                // { state: src[remove].click.map(event => state => undefined) }
              ]
            }}

            <br />

            {src =>
              <div style={{ color: get('color', src) }}>
                <ShowState />
              </div>
            }
          </pre>
        </Collection>
      </div>
    </>,
    { state: add$ }
  ]
}

function TodoList (sources) {
  const add = Symbol(0)

  const add$ = sources.react.select(add).events('click')
    .map(event => prevState => [...prevState, { text: '' }])

  const reducer$ = add$

  return [
    <>
      <input /><button sel={add}>Add</button>
      <Collection indexKey='idx'>
        <div>
          {sources => {
            const remove = Symbol(0)
            const input = Symbol(0)

            const input$ = sources.react.select(input).events('change')
              .map(event => event.target.value)
              .map(value => prevState => ({ text: value }))

            const remove$ = sources.react.select(remove).events('click')
              .map(event => prevState => undefined)

            return [
              <>
                <input sel={input} defaultValue={get('text', sources)} />
                <button sel={remove}>Remove</button>
              </>,
              { state: xs.merge(input$, remove$) }
            ]
          }}
        </div>
      </Collection>
    </>,
    { state: reducer$ }
  ]
}

function main (sources) {
  const state$ = sources.state.stream

  const reducer$ = xs.of(() => ({
    color: 'red',
    list: [{ color: 'red' }, { color: 'green' }],
    todoList: [{ text: 'todo1' }, { text: 'todo2' }, { text: 'todo3' }],
    foo: { bar: { baz: 5 } }
  }))

  const color$ = state$.map(state => state.color)

  return [
    <div className='uk-padding-small'>
      <h2>Powercycle Showcase</h2>

      <div className='grid'>
        <Card title='Cycle JS component'>
          <Combobox />
        </Card>

        <Card title='React components under <ReactRealm>'>
          <ReactRealm>
            <ReactCounter style={{ width: '90px', float: 'left' }} />
            <ReactCounter style={{ width: '90px', float: 'left' }} />
            text node
          </ReactRealm>
        </Card>

        <Card title='React component + Cycle state'>
          <ReactRealm>
            <ReactComboboxWithCycleState />
          </ReactRealm>
        </Card>

        <Card title='Little stuff'>
          Timer: {xs.periodic(1000).startWith(-1)}
          <br />
          Counter: <Counter />
        </Card>

        <Card title='Get state in nested component'>
          <ShowState />
        </Card>

        <Card title='Todo List'>
          <TodoList lens='todoList' />
        </Card>

        <Card title='Another counter' style={{ display: 'none' }}>
          <Counter />
        </Card>

        <Card title='Simple input' lens='color'>
          Color:
          {sources => {
            const input = Symbol(0)

            const input$ = sources.react.select(input).events('change')
              .map(event => event.target.value)
              .map(value => prevState => value)

            return [
              <input sel={input} value={get('', sources)} />,
              { state: input$ }
            ]
          }}
          <br />
        </Card>

        <Card title={color$.map(color => `Stream travelling through prop: ${color}`)} />

        <Card title='Stream DOM prop' style={{ background: color$ }}>
          <Code>
            &lt;div style={'{{'} background: color$ {}}}&gt;
          </Code>
        </Card>

        <Card title='Lenses'>
          <ComboboxWithLens lens='color' />
          <br />
          foo.bar.baz: <ShowState lens='foo.bar.baz' />
        </Card>

        <Card title='React component + Cycle state + Lenses'>
          <ReactRealm lens='color'>
            <ReactComponentWithCycleStateAndLens />
          </ReactRealm>
        </Card>

        <Card title='Collection'>
          <CollectionDemo lens='list' />
        </Card>
      </div>
    </div>,
    { state: reducer$ }
  ]
}

const drivers = {
  react: makeDOMDriver(document.getElementById('app'))
}

run(withState(withPower(main)), drivers)
