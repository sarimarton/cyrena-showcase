import xs from 'xstream'
import sample from 'xstream-sample'
import { circular } from 'powercycle/util/xstream'

import { run } from '@cycle/run'
import { withState } from '@cycle/state'
import { useState } from 'react'
import { makeHTTPDriver } from '@cycle/http'

import './style.css'

import withPower, { makeDOMDriver } from 'powercycle'

import {
  $, $map, $for, $if, $not, $and, $or, $eq,
  Scope, If, Collection, COLLECTION_DELETE
} from 'powercycle/util'

import { smellyComponentStream } from 'powercycle/src/util/smellyComponentStream.js'

import { ReactRealm, useCycleState } from 'powercycle/util/ReactRealm'

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
  const count$ = sources[inc].click
    .fold(count => count + 1, 0)

  return (
    <>
      {count$}<br />
      <button sel={inc}>Incremenet</button>
    </>
  )
}

function Combobox (sources) {
  return [
    <>
      <label>Color: </label>
      <select sel='select' value={$.color}>
        <option value='#1e87f0'>default</option>
        <option value='red'>red</option>
        <option value='purple'>purple</option>
        <option value='green'>green</option>
        <option value='gray'>gray</option>
        <option value='black'>black</option>
        <option value='orange'>orange</option>
      </select>
    </>,
    { state: sources.sel['select'].change['target.value']
      .debug(() => console.info('If this message is logged once at a time, ' +
        'that means that the view channels are properly scoped automatically.'))
      .map(value => prevState => ({ ...prevState, color: value }))
    }
  ]
}

function ComboboxWithLens (sources) {
  return (
    <>
      <label>Color: </label>
      <select value={$} onChange={({ target: { value }}) => () => value}>
        <option value='#1e87f0'>default</option>
        <option value='red'>red</option>
        <option value='purple'>purple</option>
        <option value='gray'>gray</option>
        <option value='green'>green</option>
      </select>
    </>
  )
}

function ShowState (sources) {
  // return {
  //   react: sources.state.stream.map(state => <Code>{JSON.stringify(state)}</Code>)
  // }
  //
  // return power(
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
    <Code>{$map(JSON.stringify)}</Code>
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
  return [
    <>
      <div>
        <button scope='foobar.list' onClick={ev => prev => [...prev, { color: '#1e87f0' }]}>
          Add
        </button>
      </div>
      <br />
      <div>
        <Collection for='foobar.list'>
          <pre>
            {/* Different ways to get state key */}
            {/* {src => <>{src.state.stream.map(s => s.idx)}</>} */}
            {/* <Scope scope='idx'>{$get()}</Scope> */}
            {/* {$map(s => s.idx)} */}
            {$map(i => i + 1, $.index)}

            .{' '}

            <Combobox scope='item' />

            <button
              style={{ float: 'right' }}
              onClick={{
                state: ev$ => ev$.mapTo(COLLECTION_DELETE),
                HTTP: ev$ => ev$.mapTo({ url: '?this-request-tests-that-collection-picks-up-all-sinks' })
              }}
            >
              Remove this 2
            </button>

            {src => [
              <button
                style={{ float: 'right' }}
                onClick={ev => COLLECTION_DELETE}
              >Remove this</button>,
              {
                HTTP: src.el.click.mapTo({ url: '?this-request-tests-that-collection-picks-up-all-sinks' })
              }
            ]}

            {src =>
              <button
                style={{ float: 'right' }}
                onClick={{
                  outerState: ev$ => ev$
                    .compose(sample(src.state.stream))
                    .map(state => outerState => ({
                      ...outerState,
                      color: state.item.color
                    }))
                }}
              >Set 2</button>
            }

            <button
              style={{ float: 'right' }}
              onClick={ev => prev => ({
                ...prev,
                outerState: {
                  ...prev.outerState,
                  color: prev.item.color
                }
              })}
            >Set</button>

            <button
              style={{ float: 'right' }}
              onClick={ev => prev => ({
                ...prev,
                collection: prev.collection.slice(0, prev.index + 1)
              })}
            >Remove below</button>

            <br />

            <div style={{ color: $.item.color }}>
              <br />
              <ShowState scope='item' />
            </div>
          </pre>
        </Collection>
      </div>
    </>
  ]
}

function TodoList (sources) {
  const updateValue$ = sources.sel['addField'].change['target.value']
    .startWith('')

  const [value$, itemAdded$] = circular(
    reducer$ => xs.merge(
      updateValue$,
      reducer$.mapTo('')
    ).startWith(''),

    value$ => xs.merge(
      sources.sel['addButton'].click,
      sources.sel['addField'].keyDown.keyCode
        .filter(code => code === 13)
    ).compose(sample(value$))
  )

  const reducer$ = itemAdded$
    .map(text => prevState => [...prevState, { text }])

  return [
    <>
      <input sel='addField' value={value$} style={{ width: 50 }} />&nbsp;
      <button sel='addButton'>Add</button>

      {$for('',
        <div>
          <input
            scope='item.text'
            value={$}
            onChange={({ target: { value } }) => () => value}
            style={{ width: 50 }}
          />
          &nbsp;
          <button onClick={() => COLLECTION_DELETE}>Remove</button>
        </div>
      )}
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
      <h5>{sources.props.title}</h5>
      <div>{sources.props.children}</div>
    </div>
  )
}

function main (sources) {
  const state$ = sources.state.stream

  const reducer$ = xs.of(() => ({
    color: 'gray',
    foobar: { list: [{ color: 'red' }, { color: 'green' }, { color: '#1e87f0' }, { color: 'purple' }] },
    todoList: [{ text: 'todo1' }, { text: 'todo2' }, { text: 'todo3' }],
    foo: { bar: { baz: 5 } }
  }))

  const color$ = state$.map(state => state.color)

  return [
    <div className='uk-padding-small'>
      <h2>Powercycle Showcase</h2>

      <div className='grid'>
        <Card title='Cycle JS components'>
          <div style={{ float: 'left' }}>
            Auto-scoped:<br />
            <Combobox />
            <br />
            <Combobox />
          </div>
          <div style={{ float: 'right' }}>
            With noscope:<br />
            <Combobox noscope />
            <br />
            <Combobox noscope />
          </div>
          <br style={{ clear: 'both' }} />
          (See the console for testing)
        </Card>

        <Card title='React components under <ReactRealm>'>
          <ReactRealm>
            <ReactCounter style={{ width: '90px', float: 'left' }} />
            <ReactCounter style={{ width: '90px', float: 'left' }} />
            text node
          </ReactRealm>
          <br /><br />
          With Cycle state:&nbsp;
          <ReactRealm>
            <ReactComboboxWithCycleState />
          </ReactRealm>
          <br />
          With Cycle state + Scope:&nbsp;
          <ReactRealm scope='color'>
            <ReactComponentWithCycleStateAndLens />
          </ReactRealm>
        </Card>

        <Card title='Conditionals'>
          <If cond={$map(state => ['gray', 'red'].includes(state.color))}
            then={<>Red or gray!&nbsp;<Combobox /></>}
            else={'Not red and not gray'}
          />
          <br />

          <If cond={$not($map(state => ['gray', 'red'].includes(state.color)))}
            then={'Not red and not gray'}
            else={<>Red or gray!&nbsp;<Combobox /></>}
          />
          <br />

          <If scope='color' cond={$not($and(
            $not($eq($, 'gray')),
            $not($map(c => c === 'red'))
          ))}
            then={<>Red or gray!&nbsp;<ComboboxWithLens /></>}
            else={'Not red and not gray'}
          />
          <br />

          <If cond={
            $or(
              $map(state => state.color === 'gray'),
              $eq($.color, 'red')
            )
          }
            then={<>Red or gray!&nbsp;<Combobox /></>}
            else={'Not red and not gray'}
          />
          <br />

          <If cond={
            $or(
              $map(state => state.color === 'gray'),
              $map(state => state.color === 'red')
            )
          }
            then={<>Red or gray!&nbsp;<Combobox /></>}
            else={'Not red and not gray'}
          />
          <br />

          if prop:&nbsp;
          <span if={$map(state => ['gray', 'red'].includes(state.color))}>
            Red or gray - {$(color$).length}
          </span>
          <br />

          $if() function w/ stream:&nbsp;
          <span>
            {$if(color$.map(color => ['gray', 'red'].includes(color)), 'Red or gray', 'nope')}
          </span>
          <br />

          $if() function w/ stream callback:&nbsp;
          <span>
            {$if($map(state => ['gray', 'red'].includes(state.color)), 'Red or gray', 'nope')}
          </span>
          <br />

          $if() function w/ $ proxy:&nbsp;
          <span>
            {$if($.todoList.length, 'We have todos', 'Empty todos')}
          </span>
          <br />

          <br />
          prop order tests:<br />
          <small>
            scope + if (should show true or nothing):&nbsp;
            <span scope={{ state: {
              get: state => ['gray', 'red'].includes(state.color)
            } }} if={$map(state => state)}>
              {$map(String)}
            </span>
            <br />

            if + scope (should show the color or nothing):&nbsp;
            <span
              if={$map(state => ['gray', 'red'].includes(state.color))}
              scope='color'
            >
              {$}
            </span>
          </small>
        </Card>

        <Card title='Little stuff'>
          Timer: {xs.periodic(1000).startWith(-1)}
          <br />
          Counter: <Counter />
        </Card>

        <Card title='State'>
          <ShowState />
        </Card>

        <Card title={<>Todo List - {$.todoList.length}</>}>
          <TodoList scope='todoList' />
        </Card>

        <Card title='Another counter' style={{ display: 'none' }}>
          <Counter />
        </Card>

        <Card title='Simple input' scope='color'>
          Color:
          <input value={$} onChange={({ target: { value } }) => () => value} />
        </Card>

        <Card scope='color' title={<>Stream travelling through prop: {$}</>} />

        <Card title='Stream in nested DOM prop' style={{ background: color$ }}>
          <Code>&lt;div style={'{{'} background: color$ {}}}&gt;</Code>
        </Card>

        <Card title='Scopes'>
          <ComboboxWithLens scope='color' />
          <br />
          foo.bar.baz:&nbsp;
          <ShowState scope='foo.bar.baz' />
          <br />
          <Scope scope={{ state: {
            get: state => state.foo,
            set: (state, childState) => ({ ...state, foo: childState })
          } }}>
            <ShowState />
          </Scope>
        </Card>

        <Card title='Collection'>
          <CollectionDemo />
        </Card>

        <Card title='Smelly component stream (loses focus)'>
          {smellyComponentStream(sources.state.stream.map(state =>
            <>
            {state.foobar.list.map((item, idx) =>
              // 'key' is a React dependency, it's also a smell
              <div key={idx}>
                <Combobox scope={{
                  state: {
                    get: () => item,
                    set: (outer, inner) => ({
                      ...outer,
                      foobar: {
                        ...outer.foobar,
                        list: Object.assign(
                          outer.foobar.list,
                          { [idx]: inner }
                        )
                      }
                    })
                  }
                }} />
              </div>
            )}
            </>
          ))}
        </Card>
      </div>
    </div>,
    { state: reducer$ }
  ]
}

const drivers = {
  react: makeDOMDriver(document.getElementById('root')),
  HTTP: makeHTTPDriver()
}

run(withState(withPower(main)), drivers)
