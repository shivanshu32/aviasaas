import { useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Image,
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
  { command: 'insertImage', label: 'Insert image/signature', icon: Image, isCustom: true },
  { divider: true },
  { command: 'undo', label: 'Undo', icon: Undo2 },
  { command: 'redo', label: 'Redo', icon: Redo2 },
];

const fontSizeOptions = [
  { value: '1', label: '10 px' },
  { value: '2', label: '12 px' },
  { value: '3', label: '14 px' },
  { value: '4', label: '16 px' },
  { value: '5', label: '18 px' },
  { value: '6', label: '24 px' },
  { value: '7', label: '32 px' },
];

const SIGNATURE_IMAGE_STYLE = 'max-width: 180px; max-height: 90px; width: auto; height: auto; object-fit: contain;';

function cleanPastedHtml(html) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');

  parsed.body.querySelectorAll('*').forEach((element) => {
    // Keep useful emphasis and layout, while removing pasted colors, backgrounds,
    // font sizes, and other source-document styling.
    element.removeAttribute('color');
    element.removeAttribute('bgcolor');
    if (element.tagName === 'FONT') element.removeAttribute('size');
    if (element.hasAttribute('style')) {
      const safeStyles = element.getAttribute('style').split(';').filter((declaration) => {
        const property = declaration.split(':', 1)[0]?.trim().toLowerCase();
        return property && !['color', 'background', 'background-color', 'font-size', 'font-family'].includes(property);
      });
      if (safeStyles.length) element.setAttribute('style', safeStyles.join(';'));
      else element.removeAttribute('style');
    }

    if (element.tagName === 'IMG') {
      element.setAttribute('style', SIGNATURE_IMAGE_STYLE);
      element.setAttribute('alt', element.getAttribute('alt') || 'Report image or signature');
    }
  });

  return parsed.body.innerHTML;
}

export default function RichTextEditor({ value, onChange }) {
  const editorFrameRef = useRef(null);
  const editorRef = useRef(null);
  const selectionRef = useRef(null);
  const fileInputRef = useRef(null);
  const activeImageRef = useRef(null);
  const draggingImageRef = useRef(null);
  const [signatureWidth, setSignatureWidth] = useState('180');
  const [hasSelectedImage, setHasSelectedImage] = useState(false);
  const [imageFrame, setImageFrame] = useState(null);
  const resizeStartRef = useRef(null);

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

  const insertImage = (file) => {
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement('img');
      img.src = e.target.result;
      img.style.cssText = SIGNATURE_IMAGE_STYLE;
      img.alt = 'Inserted image';

      editorRef.current?.focus();
      
      const selection = window.getSelection();
      if (!selection.rangeCount) {
        editorRef.current?.appendChild(img);
      } else {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(img);

        range.setStartAfter(img);
        range.setEndAfter(img);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      onChange(editorRef.current?.innerHTML || '');
      saveSelection();
    };

    reader.readAsDataURL(file);
  };

  const handleImageUpload = () => {
    saveSelection();
    fileInputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      insertImage(file);
      event.target.value = '';
    }
  };

  const handlePaste = (event) => {
    const clipboardData = event.clipboardData || window.clipboardData;
    const items = clipboardData?.items;

    if (!clipboardData) return;

    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (item.type.indexOf('image') !== -1) {
          event.preventDefault();
          const blob = item.getAsFile();
          insertImage(blob);
          return;
        }
      }
    }

    const html = clipboardData.getData('text/html');
    if (!html) return;

    event.preventDefault();
    editorRef.current?.focus();
    if (selectionRef.current) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(selectionRef.current);
    }
    document.execCommand('insertHTML', false, cleanPastedHtml(html));
    onChange(editorRef.current?.innerHTML || '');
    saveSelection();
  };

  const selectReportImage = (event) => {
    const image = event.target.closest('img');
    activeImageRef.current = image && editorRef.current?.contains(image) ? image : null;
    setHasSelectedImage(Boolean(activeImageRef.current));
    if (!activeImageRef.current) {
      setImageFrame(null);
      return;
    }

    const currentWidth = Number.parseInt(activeImageRef.current.style.width, 10)
      || Number.parseInt(activeImageRef.current.getAttribute('width'), 10)
      || 180;
    setSignatureWidth(String(Math.min(currentWidth, 180)));
    updateImageFrame(activeImageRef.current);
  };

  const updateImageFrame = (image) => {
    if (!image || !editorFrameRef.current) return;
    const imageRect = image.getBoundingClientRect();
    const frameRect = editorFrameRef.current.getBoundingClientRect();
    setImageFrame({
      left: imageRect.left - frameRect.left,
      top: imageRect.top - frameRect.top,
      width: imageRect.width,
      height: imageRect.height,
    });
  };

  const resizeReportImage = (event) => {
    const image = activeImageRef.current;
    if (!image) return;

    const width = Number(event.target.value);
    image.style.width = `${width}px`;
    image.style.height = 'auto';
    image.style.maxWidth = '180px';
    image.style.maxHeight = '90px';
    setSignatureWidth(String(width));
    onChange(editorRef.current?.innerHTML || '');
    updateImageFrame(image);
  };

  const startCornerResize = (event) => {
    const image = activeImageRef.current;
    if (!image) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeStartRef.current = {
      pointerX: event.clientX,
      width: image.getBoundingClientRect().width,
    };
  };

  const moveCornerResize = (event) => {
    if (!resizeStartRef.current || !activeImageRef.current) return;
    const width = Math.max(20, Math.min(180,
      Math.round(resizeStartRef.current.width + event.clientX - resizeStartRef.current.pointerX)));
    const image = activeImageRef.current;
    image.style.width = `${width}px`;
    image.style.height = 'auto';
    image.style.maxWidth = '180px';
    image.style.maxHeight = '90px';
    setSignatureWidth(String(width));
    onChange(editorRef.current?.innerHTML || '');
    updateImageFrame(image);
  };

  const stopCornerResize = () => {
    resizeStartRef.current = null;
  };

  const startImageDrag = (event) => {
    const image = event.target.closest('img');
    if (!image || !editorRef.current?.contains(image)) return;
    draggingImageRef.current = image;
    activeImageRef.current = image;
    setHasSelectedImage(true);
    updateImageFrame(image);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', 'report-signature');
  };

  const dropImageAtPoint = (event) => {
    const image = draggingImageRef.current;
    if (!image || !editorRef.current) return;

    event.preventDefault();
    let range = document.caretRangeFromPoint?.(event.clientX, event.clientY);
    if (!range && document.caretPositionFromPoint) {
      const position = document.caretPositionFromPoint(event.clientX, event.clientY);
      if (position) {
        range = document.createRange();
        range.setStart(position.offsetNode, position.offset);
        range.collapse(true);
      }
    }
    if (!range || !editorRef.current.contains(range.startContainer)) return;

    range.insertNode(image);
    range.setStartAfter(image);
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    draggingImageRef.current = null;
    onChange(editorRef.current.innerHTML);
    saveSelection();
    updateImageFrame(image);
  };

  return (
    <div ref={editorFrameRef} className="relative overflow-hidden rounded-xl border border-gray-200 bg-white focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100">
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-3 py-2">
        <select
          aria-label="Paragraph style"
          className="mr-1 h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 outline-none hover:bg-gray-50"
          defaultValue="p"
          onMouseDown={saveSelection}
          onChange={(event) => applyCommand('formatBlock', event.target.value)}
        >
          <option value="p">Paragraph</option>
          <option value="h2">Heading 1</option>
          <option value="h3">Heading 2</option>
          <option value="blockquote">Quote</option>
        </select>

        <label className="flex items-center gap-2 text-xs text-gray-600" title="Click a signature or image in the report, then drag to resize it">
          Signature size
          <input
            type="range"
            aria-label="Selected signature size"
            className="w-24 accent-teal-700 disabled:opacity-40"
            min="20"
            max="180"
            step="1"
            value={signatureWidth}
            disabled={!hasSelectedImage}
            onChange={resizeReportImage}
          />
          <span className="w-10 text-right tabular-nums">{signatureWidth}px</span>
        </label>

        <select
          aria-label="Font size"
          title="Font size"
          className="mr-1 h-8 w-[78px] rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 outline-none hover:bg-gray-50"
          defaultValue="3"
          onMouseDown={saveSelection}
          onChange={(event) => applyCommand('fontSize', event.target.value)}
        >
          {fontSizeOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
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
                if (button.isCustom && button.command === 'insertImage') {
                  handleImageUpload();
                } else {
                  applyCommand(button.command);
                }
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
        onPaste={handlePaste}
        onClick={selectReportImage}
        onDragStart={startImageDrag}
        onDragOver={(event) => {
          if (draggingImageRef.current) event.preventDefault();
        }}
        onDrop={dropImageAtPoint}
        onDragEnd={() => { draggingImageRef.current = null; }}
      />

      {imageFrame && hasSelectedImage && (
        <div
          className="pointer-events-none absolute z-10 border border-dashed border-teal-700"
          style={{
            left: imageFrame.left,
            top: imageFrame.top,
            width: imageFrame.width,
            height: imageFrame.height,
          }}
        >
          <button
            type="button"
            aria-label="Resize selected signature from the corner"
            title="Drag to resize"
            className="pointer-events-auto absolute -bottom-2 -right-2 h-4 w-4 touch-none rounded-full border-2 border-teal-700 bg-white shadow"
            onPointerDown={startCornerResize}
            onPointerMove={moveCornerResize}
            onPointerUp={stopCornerResize}
            onPointerCancel={stopCornerResize}
          />
        </div>
      )}

      <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-right text-xs text-gray-400">
        Drag a signature/image to move it; drag its lower-right handle to resize it. Pasted text prints in black.
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />
    </div>
  );
}
