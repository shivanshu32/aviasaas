import { useEffect, useRef } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Underline,
  Undo2,
} from 'lucide-react';

const toolbarButtons = [
  { command: 'bold', label: 'Bold', icon: Bold },
  { command: 'italic', label: 'Italic', icon: Italic },
  { command: 'underline', label: 'Underline', icon: Underline },
  { divider: true },
  { command: 'justifyLeft', label: 'Align left', icon: AlignLeft },
  { command: 'justifyCenter', label: 'Align center', icon: AlignCenter },
  { command: 'justifyRight', label: 'Align right', icon: AlignRight },
  { divider: true },
  { command: 'insertUnorderedList', label: 'Bulleted list', icon: List },
  { command: 'insertOrderedList', label: 'Numbered list', icon: ListOrdered },
  { divider: true },
  { command: 'undo', label: 'Undo', icon: Undo2 },
  { command: 'redo', label: 'Redo', icon: Redo2 },
];

export default function RichTextEditor({ value, onChange }) {
  const editorRef = useRef(null);
  const selectionRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const saveSelection = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editorRef.current) return;

    const range = selection.getRangeAt(0);
    if (editorRef.current.contains(range.commonAncestorContainer)) {
      selectionRef.current = range.cloneRange();
    }
  };

  const applyCommand = (command, commandValue = null) => {
    editorRef.current?.focus();
    if (selectionRef.current) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(selectionRef.current);
    }
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML || '');
    saveSelection();
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100">
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-3 py-2">
        <select
          aria-label="Text style"
          className="mr-1 h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 outline-none hover:bg-gray-50"
          defaultValue="p"
          onMouseDown={saveSelection}
          onChange={(event) => applyCommand('formatBlock', event.target.value)}
        >
          <option value="p">Normal</option>
          <option value="h2">Heading</option>
          <option value="h3">Subheading</option>
          <option value="blockquote">Quote</option>
        </select>

        {toolbarButtons.map((button, index) => {
          if (button.divider) {
            return <span key={`divider-${index}`} className="mx-1 h-5 w-px bg-gray-300" />;
          }

          const Icon = button.icon;
          return (
            <button
              key={button.command}
              type="button"
              title={button.label}
              aria-label={button.label}
              onMouseDown={(event) => {
                event.preventDefault();
                applyCommand(button.command);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-white hover:text-primary-700 hover:shadow-sm"
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>

      <div
        ref={editorRef}
        className="report-editor min-h-[380px] px-6 py-5 text-sm leading-7 text-gray-800 outline-none"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Medical report content"
        data-placeholder="Write the patient's medical report here..."
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
      />

      <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-right text-xs text-gray-400">
        Rich text editor • Formatting is preserved in the printed report
      </div>
    </div>
  );
}
