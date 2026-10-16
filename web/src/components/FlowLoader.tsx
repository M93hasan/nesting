/** Decorative loading motion for the active Serula solver/status.
 *  Three independent SVG pegs; no timers, DOM listeners, or worker changes.
 */
export default function FlowLoader(){
  return <span className="serula-flow-loader" aria-hidden="true">
    <svg className="serula-peg serula-peg--one" viewBox="0 0 30 30" focusable="false"><g><path d="M15 2.5 25.8 8.7v12.6L15 27.5 4.2 21.3V8.7Z"/></g></svg>
    <svg className="serula-peg serula-peg--two" viewBox="0 0 30 30" focusable="false"><g><path d="M15 2.5 25.8 8.7v12.6L15 27.5 4.2 21.3V8.7Z"/></g></svg>
    <svg className="serula-peg serula-peg--three" viewBox="0 0 30 30" focusable="false"><g><path d="M15 2.5 25.8 8.7v12.6L15 27.5 4.2 21.3V8.7Z"/></g></svg>
  </span>;
}
