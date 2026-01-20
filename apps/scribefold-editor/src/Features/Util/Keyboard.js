import React, { useMemo } from 'react';
import './Keyboard.css';

export default function Keyboard({ onPress }) {
  const rows = useMemo(() => {
    const symbols = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '=', '+'];
    const numbers = ['1','2','3','4','5','6','7','8','9','0'];

    const lettersRow1 = ['q','w','e','r','t','y','u','i','o','p'];
    const lettersRow2 = ['a','s','d','f','g','h','j','k','l'];
    const lettersRow3 = ['z','x','c','v','b','n','m'];

    return [
      { type: 'symbols', layout: 'symbols', keys: symbols },
      { type: 'numbers', layout: 'numbers', keys: numbers },
      { type: 'letters', layout: 'letters10', keys: lettersRow1 },
      { type: 'letters', layout: 'letters9', keys: lettersRow2 },
      {
        type: 'letters',
        layout: 'lettersBottom',
        keys: [
          { label: '⌫', value: 'Backspace', extraClassName: 'keyboardKey_icon' },
          { label: '⏎', value: 'Enter', extraClassName: 'keyboardKey_icon' },
          ...lettersRow3,
          { label: 'Space', value: ' ', wide: true },
        ],
      },
    ];
  }, []);

  function handlePress(key) {
    if (typeof onPress === 'function') onPress(key);
  }

  function getKeyLabel(key) {
    if (key && typeof key === 'object') return String(key.label ?? key.value ?? '');
    return String(key ?? '');
  }

  function getKeyValue(key) {
    if (key && typeof key === 'object') return String(key.value ?? key.label ?? '');
    return String(key ?? '');
  }

  function isWideKey(key) {
    return Boolean(key && typeof key === 'object' && key.wide);
  }

  function getExtraClassName(key) {
    if (key && typeof key === 'object') return String(key.extraClassName || '');
    return '';
  }

  return (
    <div className="keyboardRoot">
      {rows.map((row, idx) => (
        <div
          key={`${row.type}-${idx}`}
          className={`keyboardRow keyboardRow_${row.type} ${row.layout ? `keyboardRow_layout_${row.layout}` : ''}`}
        >
          {row.keys.map((key) => (
            <button
              key={`${row.type}-${getKeyLabel(key)}`}
              type="button"
              className={`keyboardKey keyboardKey_${row.type} ${isWideKey(key) ? 'keyboardKey_wide' : ''} ${getExtraClassName(key)}`}
              onClick={() => handlePress(getKeyValue(key))}
            >
              {getKeyLabel(key)}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
