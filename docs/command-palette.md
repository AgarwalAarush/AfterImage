# Paper command palette

The signed-in application exposes one paper command palette from the header’s **Add a paper** button or <kbd>⌘K</kbd> (with <kbd>Ctrl</kbd>+<kbd>K</kbd> as the non-macOS equivalent). It has three deliberate paths:

- Search matches title, author, arXiv ID, topic, abstract, and generated recall across `state.papers`, including papers that have been suggested but are not yet saved. Selecting a result opens its notecard.
- A debounced topic, title, or author query searches the official arXiv API and OpenAlex through the authenticated `/api/search` route. Only results with a canonical arXiv identity enter the current intake UI. Selecting an external result imports that record, queues its notecard, and opens the paper page. Provider failure is visible and never misrepresented as an exhaustive search. The interactive arXiv lane is time-boxed to 1.2 seconds and does not wait on the slower HTML fallback; that broader lane remains in the background recommendation worker.
- A pasted arXiv ID, arXiv URL, or alphaXiv URL presents an **Add this paper** action. Selecting it uses the established `import` mutation, which creates the saved library entry, queues a missing notecard when capacity permits, and opens the imported paper.

The input retains keyboard focus while arrow keys move across local and discovered results and Enter selects the active item. Escape dismisses the native dialog. Invalid imports remain in the palette and show the server’s validation message, so the pasted value is not lost. A changing query aborts the previous request; a 300 ms debounce and ten-result cap bound provider traffic.
