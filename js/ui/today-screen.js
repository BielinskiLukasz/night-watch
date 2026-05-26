// js/ui/today-screen.js
// Plan 01 walking-skeleton UI: a single quick-log button + an event list.
// Plan 03 replaces this with the full 4-button day-grouped renderer.
//
// Security invariants (T-07 / V5):
//   - Every dynamic value goes through textContent, never innerHTML.
//   - The container is cleared via replaceChildren() (modern equivalent
//     of `innerHTML = ""` without the antipattern smell).
//   - data-attributes (data-log, data-role) carry behavior keys; no
//     untrusted string is ever assigned to innerHTML.

/**
 * @param {{ root: HTMLElement, eventLog: { addEvent: (type: string) => object, listEvents: () => Array<object> } }} deps
 */
export function mountTodayScreen({ root, eventLog }) {
  // Build the quick-log button
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('data-log', 'wake');
  button.textContent = 'Woke up';

  // Build the events list (newest first as Plan 03 will refine; for now,
  // insertion order is fine — there's only ever one event in walking-skeleton
  // smoke testing).
  const list = document.createElement('ul');
  list.setAttribute('data-role', 'events');

  root.replaceChildren(button, list);

  // Render existing events on mount (rehydration after reload — DATA-04).
  render();

  // Delegate the click on the button. (Single button in Plan 01; Plan 03
  // moves to a delegated listener on the buttons container.)
  button.addEventListener('click', () => {
    eventLog.addEvent('wake');
    render();
  });

  function render() {
    list.replaceChildren();
    for (const evt of eventLog.listEvents()) {
      const li = document.createElement('li');
      li.setAttribute('data-event-id', evt.id);
      // Plan 03 will swap 'Wake' for a label lookup table covering all 4 types.
      li.textContent = `${evt.at}  Wake`;
      list.appendChild(li);
    }
  }
}
