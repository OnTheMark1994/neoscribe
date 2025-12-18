/*
 
 
  */
import React, { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import Editor from '@monaco-editor/react';
import './EditorMonaco.css';

export default function EditorMonaco() {
  const [value, setValue] = useState('');

  // User preferences that should affect Monaco rendering.
  const settingsObject = useSelector(state => state.settingsSlice.settingsObject);

  const initialValue = useMemo(() => {
    return [
      '#chapter Introduction',
      '',
      'This is a basic Monaco editor instance.',
      '',
      '#section Notes',
      '- You can type here.',
    ].join('\n');
  }, []);

  return (
    <div className="editorMonacoContainer">
      <Editor
        height="100%"
        defaultLanguage="markdown"
        defaultValue={initialValue}
        onChange={(nextValue) => setValue(nextValue ?? '')}
        beforeMount={(monaco) => {
          // Create a theme that matches vs-dark but uses a transparent editor background.
          monaco.editor.defineTheme('scribefold-transparent-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
              // Remove the blue focus border and the current-line border/highlight.
              'focusBorder': '#00000000',
              'editor.lineHighlightBorder': '#00000000',
              'editor.lineHighlightBackground': '#00000000',
              'editor.hoverHighlightBackground': '#00000000',

              // Remove selection / occurrence / "clicked word" highlights.
              'editor.selectionHighlightBackground': '#00000000',
              'editor.selectionHighlightBorder': '#00000000',
              'editor.wordHighlightBackground': '#00000000',
              'editor.wordHighlightBorder': '#00000000',
              'editor.wordHighlightStrongBackground': '#00000000',
              'editor.wordHighlightStrongBorder': '#00000000',
              'editor.symbolHighlightBackground': '#00000000',
              'editor.symbolHighlightBorder': '#00000000',

              // Ensure the real Monaco caret is visible.
              'editorCursor.foreground': '#FFFFFF',

              'editor.background': '#00000000',
              'editorGutter.background': '#00000000',
              'minimap.background': '#00000000',
            },
          });
        }}
        theme="scribefold-transparent-dark"
        options={{
          // Line number gutter.
          lineNumbers: settingsObject?.showMonacoLineNumbers ? 'on' : 'off',

          // Sticky top bar / sticky scroll.
          stickyScroll: { enabled: Boolean(settingsObject?.monacoStickyTopBar) },

          // Right-side overview/minimap.
          minimap: { enabled: Boolean(settingsObject?.showPreviewBar) },
          overviewRulerLanes: settingsObject?.showPreviewBar ? 3 : 0,
          overviewRulerBorder: false,

          // Remove the focused/hovered line styling.
          renderLineHighlight: 'none',
          renderLineHighlightOnlyWhenFocus: false,

          // Remove "click word" / occurrences / selection highlight overlays.
          selectionHighlight: false,
          occurrencesHighlight: 'off',

          fontSize: 14,
          wordWrap: 'on',
          automaticLayout: true,
        }}
      />
    </div>
  );
}
