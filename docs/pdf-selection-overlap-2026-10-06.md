# Reader selection and PDF overlap correction

The PDF reader renders the original page on a canvas and places transparent selectable text above it. The global Dark appearance selection rule supplies an off-white foreground. The PDF selection rule previously replaced only the background, so selecting a passage exposed the overlay lettering above the original black letters.

The PDF-specific selection rule in `src/app/ui.css` now explicitly keeps the foreground transparent while retaining its existing translucent highlight. Its specificity matches the Dark appearance rule, and `ui.css` is imported after `theme.css`. The override covers text-layer spans and nested search marks. Text positioning, PDF rendering, copying, search and citation highlight backgrounds, and ordinary prose selection are unchanged.

Escape previously hid the Ask AI popover without clearing the browser's selected range. The following keyup captured that same range and reopened the popover. Escape now clears the actual selection, the popover, and its temporary question together. The Dismiss selection button uses the same dismissal. This applies to PDF text and reader prose; a selected passage is dismissed before an already-open assistant panel. The PDF find panel retains its existing first-Escape handling.

This is a local web presentation change. No API, storage, worker, content or progress migration is required. Shared CSS remains part of the Subjects presentation fingerprint; the normal publication workflow requires renewed independent visual acceptance against the changed presentation, preserving exact parent and scientific digests. The owner subsequently verified this reader change and explicitly authorized release without more browser verification; the exact-source exception below records that decision.

## Validation and release status

Native Dia inspection originally confirmed transparent PDF selection in Dark at 220%. Later Dia checks covered the loading presentation in Light and Dark; the owner subsequently reported their own verification and instructed clean merge and deployment after basic tests. This owner decision is recorded in the separate exact-source PDF release exception, not represented as a new independent browser report. See [PDF loading presentation](pdf-loading-presentation-2026-10-06.md) for its bounded scope and the combined release evidence.

Typecheck and the complete suite pass: 403 tests passed, one skipped. The publication audit accepts all 100 lessons, 203 figures and 14 mechanisms. The committed lockfile remains unchanged (`4551ca961c528d4a4edb033d63dfef70bfe09ab1dda04306493ee59bd45abc2d`), and font metrics still match. Existing lesson, mechanism, scientific, parent, renderer and every-beat approval bytes are preserved. No dependency, worker, API, storage or stored-content migration is required.
