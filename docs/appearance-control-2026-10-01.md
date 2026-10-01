# Appearance control refinement

The header and login screen now use a compact System / Light / Dark icon selector
instead of the native dropdown and detached appearance icon. Monitor, sun, and
moon icons share the existing Lucide stroke style. One inset surface identifies
the selected preference, with palette-aware hover and keyboard focus states.

A native radio group provides accessible names, one tab stop, and arrow-key
selection. Tooltips name each choice and explain that System follows the device.
Each rendered instance has a unique group name. The browser-local storage,
before-paint initialization, system changes, and cross-tab synchronization remain
the same. No library, SVG renderer, bridge, or worker changes are needed.

Local verification: TypeScript and the three existing theme regressions passed.
Browser checks passed for reload persistence, native arrow-key selection, system
light/dark changes, cross-tab synchronization, header/login placement, and the
390px header without horizontal overflow. Light/dark screenshots were inspected.
The design detector reported no findings. The local console reported an existing
missing favicon, with no framework error overlay.

This refinement requires only a web release.
