'use babel'

/* @flow */

import InterpreterMi2                                 from './interpreter-mi2'

import type {
  Breakpoint, BreakpointEvent,
  DebuggerTarget, SessionEvent }                      from 'debugger'

import { process }                                    from 'process'
import { BufferedProcess, Disposable, Emitter, File } from 'atom'

export default class DebuggerMi2 {
  interpreter: InterpreterMi2;
  emitter:     Emitter;
  process:     ?process;

  constructor() {
    this.interpreter = new InterpreterMi2()
    this.emitter     = this.interpreter.emitter
    this.process     = null

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

  sendCommand<R>(
    command:  string,
    resolve?: (result: Promise<R> | R) => void,
    reject?:  (error: any) => void): void {

    const process     = this.process
    const interpreter = this.interpreter

    if (!process) { throw new Error('Session not running.') }
    if (!resolve) { resolve = (result) => {} }
    if (!reject)  { reject  = (error) => {} }

    interpreter.pushResultHandler(resolve, reject)
    process.stdin.write(command + '\n')
  }
}
