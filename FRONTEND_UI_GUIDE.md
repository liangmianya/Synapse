# Synapse Frontend UI Design Guide

## Purpose

This document defines the visual and interaction baseline for Synapse. The product is a learning workspace, so the interface must support repeated reading, comparison, writing, and canvas manipulation without decorative noise.

## Design Principles

- Prefer one clear action over several competing controls.
- Use native HTML controls with explicit CSS; never rely on browser-default button, select, or input styling.
- Keep operational UI quiet: white surfaces, stone-gray structure, and teal only for focus or primary actions.
- Do not add placeholder buttons. Every visible control must have a working result.
- Keep content hierarchy stronger than decoration. Markdown structure must be readable without oversized typography.

## Layout

- Top bar height: `52px`.
- Status bar height: `28px`.
- Desktop sidebar width: `232px`.
- Canvas cards use a compact `7px` radius and a 1px neutral border.
- A card header is the drag handle. The card body is the expand target. Do not bind both behaviors to the same hit area.
- A card’s internal conversation area owns wheel scrolling. The canvas owns wheel zooming only outside an internal scroll area.
- Do not render fake overview or minimap controls. A navigation aid must reflect real canvas state before it is shown.

## Controls

- Primary commands use solid teal with white text.
- Secondary commands use a white background and 1px neutral border.
- Destructive actions use red and always require confirmation.
- Icon-only controls require both `aria-label` and `title`.
- Inputs, textareas, and selects use a 1px neutral border, `6px` radius, white background, and teal focus ring.
- Menus and selects must have a stable width and must not fall back to browser-default 3D rendering.

## Canvas Behavior

- Zoom around the pointer position, not the canvas origin.
- New root nodes occupy the nearest free grid position.
- Follow-up nodes extend rightward from the parent; explicit branches prefer the right-lower area.
- Use collision detection before persisting a new node position.
- Streamed AI content updates only the affected card at a throttled rate. Do not rebuild the complete canvas for every token.

## Markdown

- Render Markdown through the shared sanitizer and parser.
- In a full conversation view, tables and code blocks must be fully styled and horizontally scrollable when needed.
- In a small canvas preview, hide wide tables and fenced code blocks rather than compressing them into unreadable content.
- Card preview headings stay at the body scale. Heading hierarchy is for content structure, not visual enlargement.

## Verification Checklist

- Check the browser CSSOM after major stylesheet edits; all newly introduced selectors must be present.
- Test button, input, select, dialog, and textarea computed styles in the browser, not only in source code.
- Test wheel zoom with the pointer at more than one location on the canvas.
- Test wheel scrolling inside an expanded card.
- Test creation, cancellation, single deletion, and batch deletion against the backend API.
- Test desktop and mobile viewport widths before delivery.
