'use babel'

/* @flow */

import InterpreterMi2                                 from './interpreter-mi2'

import type {
  Breakpoint,
  BreakpointEvent,
  DebuggerTarget,
  SessionEvent,
  StackFrame,
  TargetEvent,
  Variable,
  VariableEvent
}                  from 'debugger'

import { process } from 'process'
import {
  BufferedProcess,
  Disposable,
  Emitter,
  File
}                  from 'atom'

export default class DebuggerMi2 {
  interpreter:      InterpreterMi2;
  emitter:          Emitter;
  process:          ?process;
  variables:        Array<Variable & Disposable>;

  constructor() {
    this.interpreter = new InterpreterMi2()
    this.emitter     = this.interpreter.emitter
    this.process     = null
    this.variables   = []

    this.onSessionEvent( event => {
      if (event.type === 'terminated') {
        const debug       = this
        debug.process     = null
      }
    })

    this.onSessionEvent( event => {
      if (event.type === 'will-terminate') {
        const debug = this
        debug.stop()
      }
    })

    this.onSessionEvent( event => {
      if (event.type === 'suspended') {
        const debug = this
        this.initVariablesInScope()
      }
    })

    this.onSessionEvent( event => {
      if (event.type === 'resumed' || event.type === 'terminated') {
        this.destroyVariables()
      }
    })
  }

  name(): string {
    return 'debugger-mi2'
  }

  onBreakpointEvent(callback: ((event: BreakpointEvent) => void)): Disposable {
    return this.emitter.on('breakpoint', callback)
  }

  onSessionEvent(callback: ((event: SessionEvent) => void)): Disposable {
    return this.emitter.on('session', callback)
  }

  onTargetEvent(callback: ((event: TargetEvent) => void)): Disposable {
    return this.emitter.on('target', callback)
  }

  onVariableEvent(callback: ((event: VariableEvent) => void)): Disposable {
    return this.emitter.on('variable', callback)
  }

  start(target: DebuggerTarget, breakpoints: Breakpoint[]): Promise {
    return new Promise( () => {
      const command = atom.config.get('debugger-mi2.active-debugger')
      let   args    = atom.config.get('debugger-mi2.active-debugger-arguments') || []

      if (typeof command !== 'string') {
        atom.notifications.addError(
          'debugger-mi2.active-debugger must be a string')
        return
      }

      if (Array.isArray(args)) {
        args = args.concat(target.filePath)
      } else {
        args = [target.filePath]
      }

      let arg: string[] = args.map(val => { return String(val) })

      if (target.arguments) {
         arg = arg.concat(target.arguments)
      }

      const options = {
        command: command,
        args: arg,
        stdout: (data) => this.interpreter.interpret(data)
      }

      let bufferedProcess = new BufferedProcess(options)

      if (bufferedProcess.process) {
        this.process = bufferedProcess.process
      } else {
        throw new Error('bufferedProcess.process must be process')
      }

      const stdin = this.process.stdin

      const breakAtMain = atom.config.get('debugger-mi2.break-at-main')

      if (breakAtMain === true) {
        this.sendCommand('-break-insert main')
      }

      for (let breakpoint: Breakpoint of breakpoints) {
        const location  = breakpoint.location
        const filePath  = (location.filePath)  ? location.filePath : null
        const bufferRow = (location.bufferRow) ? location.bufferRow : null

        if (typeof bufferRow !== 'number' || typeof filePath !== 'string') {
          throw Error('Not yet implemented for this kind of breakpoint')
        }

        // XXX: workaround for lldb-mi, doesn't handle absolute filepaths
        const file    = new File(filePath)
        const command = '-break-insert ' + file.getBaseName() + ':' + bufferRow

        this.sendCommand(command)
      }

      this.sendCommand('-exec-run')
    })
  }

  stop(): void {
    this.sendCommand('-gdb-exit')
  }

  resume(): void {
    this.sendCommand('-exec-continue')
  }

  pause(): void {
    this.sendCommand('-exec-interrupt')
  }

  stepInto(): void {
    this.sendCommand('-exec-step')
  }

  stepOver(): void {
    this.sendCommand('-exec-next')
  }

  insertBreakpoint(breakpoint: Breakpoint): void {

    if (!this.process) {
      throw new Error('Session must be running')
    }

    if (breakpoint.filePath && breakpoint.bufferRow) {

      const command = '-break-insert --source ' + breakpoint.filePath +
                        ' --line ' + (breakpoint.bufferRow+1)

      this.sendCommand(command)
    } else {

      atom.notifications.addError(
        'Not yet implemented for this kind of breakpoint')
    }
  }

  removeBreakpoint(breakpoint: Breakpoint): void {
    // TODO: remove while running
  }

  getCallStack(): Promise<Array<StackFrame>> {
    return new Promise( (resolve, reject) => {

      let resolver = (o: Promise<Array<StackFrame>> | Array<StackFrame>) => {
        resolve(this.interpreter.adapter.adaptCallStackMessage(o))
      }

      this.sendCommand('-stack-list-frames', resolver, reject)
    })
  }

  getSelectedFrame(): Promise<StackFrame> {
    return new Promise( (resolve, reject) => {

      let resolver = (o: Promise<Array<StackFrame>> | Array<StackFrame>) => {
        resolve(this.interpreter.adapter.adaptStackFrameMessage(o))
      }

      this.sendCommand('-stack-info-frame', resolver, reject)
    })
  }

  setSelectedFrame(level: number): void {
    new Promise( (resolve, reject) => {
      this.sendCommand('-stack-select-frame ' + level, resolve, reject)
    }).then( () => {
      this.destroyVariables()
      this.initVariablesInScope()
    })
  }

  initVariablesInScope(): void {

    const VariableEvent = require('./main').VariableEvent

    if (!VariableEvent) { throw Error('VariableEvent must not be null') }

    const debug = this

    const resolve = (data: mixed) => {
      const variables = this.interpreter.adapter.adaptVariablesMessage(data)

      for (let i=0; i<variables.length; i++) {
        if (variables[i].value === null) { continue } // is unavailable

        const resolve = (data: mixed) => {
          if (!data.name) { throw new Error('expected "name" in message') }

          const variable: any = variables[i]

          variable.id   = data.name
          variable.dispose = () => {
            debug.sendCommand(`-var-delete ${variable.id}`)
          }

          const resolve = (data: mixed) => {
            if (!data.numchild) { throw new Error('expected "numchild" in message') }

            variable.has_children = (+data.numchild > 0)

            debug.variables.push(variable)
            debug.emitter.emit(
              'variable', new VariableEvent('entered-scope', variable)
            )
          }

          debug.sendCommand(
            `-var-list-children --no-values ${variable.id}`, resolve
          )
        }

        debug.sendCommand(`-var-create - * ${variables[i].name}`, resolve)
      }
    }

    this.sendCommand(
      '-stack-list-variables --simple-values', resolve
    )
  }

  destroyVariables(): void {
    const VariableEvent = require('./main').VariableEvent

    if (!VariableEvent) { throw new Error('VariableEvent must not be null') }

    for (let i=0; i<this.variables.length; i++) {
      this.emitter.emit('variable',
        new VariableEvent('left-scope', this.variables[i])
      )
      this.variables[i].dispose()
    }

    this.variables = []
  }

  getVariableChildren(variable: Variable): Promise<Array<Variable>> {
    return new Promise( (resolve, reject) => {
      if (!variable.id) { throw new Error('Expected "id" in variable') }

      this.sendCommand(`-var-list-children --simple-values ${variable.id}`,
        resolve, reject
      )
    }).then( (data: mixed): Array<Variable> => {

      const adapter = this.interpreter.adapter

      if (!data.numchild) { throw new Error('Expected "numchild" in message') }

      const numchild = +data.numchild

      if (numchild === 0) { return [] }
      else                { return adapter.adaptChildrenMessage(data) }
    })
  }

  sendCommand<R>(
    command:  string,
    resolve?: (result: Promise<R> | R) => void,
    reject?:  (error: any) => void): void {

    const process     = this.process
    const interpreter = this.interpreter

    if (!process) { throw new Error('Session not running.') }
    if (!resolve) { resolve = (result) => {} }
    if (!reject)  { reject  = (error) => {
      const message = (error) ? error.msg : 'Unknown error occured'
      atom.notifications.addError(message, { dismissable: true })
    } }

    interpreter.pushResultHandler(resolve, reject)
    process.stdin.write(command + '\n')
  }
}
