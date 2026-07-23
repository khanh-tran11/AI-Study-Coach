# Panther AI Assistant — Standalone Panel

A framework-agnostic, accessible chat panel featuring an illustrated panther character. Built with vanilla HTML, CSS, and JavaScript — no build tools, no dependencies. Drop it into any web backend (Flask, Django, FastAPI, etc.).

---

## Files

| File | Purpose |
|------|---------|
| `panther.css` | All styles, animations, and responsive breakpoints |
| `panther.html` | The HTML snippet (paste into your template) |
| `panther.js` | Chat logic — message sending, mock responses |
| `index.html` | Self-contained demo page (open in browser to preview) |
| `panther-avatar.svg` | Standalone SVG file (for reference — already inlined in HTML) |

---

## How to Embed

### 1. Add CSS to your `<head>`

```html
<link rel="stylesheet" href="/static/panther/panther.css">
```

### 2. Paste the HTML snippet into your page template

Copy the contents of `panther.html` into your page where you want the panel to appear. The snippet is a single `<section>` element — it works inside any container.

**Flask example (Jinja2):**
```html
{% include 'components/panther.html' %}
```

**Django example:**
```html
{% include 'panther/panther.html' %}
```

### 3. Add the script before `</body>`

```html
<script src="/static/panther/panther.js"></script>
```

---

## Customising Colors

All colors are defined as CSS custom properties at the top of `panther.css`. Override them in your own stylesheet to match your brand:

```css
:root {
  --panther-accent: #7c3aed;        /* Change brand accent */
  --panther-accent-light: #ede9fe;  /* Light accent for hover states */
  --panther-text-primary: #1a1a2e;  /* Dark text on light backgrounds */
  --panther-bg-surface: #ffffff;    /* Chat bubble background */
}
```

The hero gradient is set directly on `.panther-hero` — override it with:

```css
.panther-hero {
  background: linear-gradient(160deg, #1a0533 0%, #7c3aed 50%, #4c1d95 100%);
}
```

---

## Replacing Mock Responses with a Real API

In `panther.js`, find the `sendMessage` function. Replace the `setTimeout` block with a `fetch` call to your Python backend:

```javascript
// Replace this mock block:
setTimeout(function () {
  var reply = getNextResponse();
  var assistantBubble = createBubble(reply, 'assistant');
  messageLog.appendChild(assistantBubble);
  scrollToBottom();
}, 500);

// With a real API call:
fetch('/api/panther/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: trimmed })
})
  .then(function (res) { return res.json(); })
  .then(function (data) {
    var assistantBubble = createBubble(data.reply, 'assistant');
    messageLog.appendChild(assistantBubble);
    scrollToBottom();
  })
  .catch(function () {
    var errorBubble = createBubble(
      'Sorry, I couldn\'t connect. Please try again.',
      'assistant'
    );
    messageLog.appendChild(errorBubble);
    scrollToBottom();
  });
```

**Flask endpoint example:**
```python
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/api/panther/chat', methods=['POST'])
def panther_chat():
    data = request.get_json()
    user_message = data.get('message', '')
    # Replace with your AI/LLM logic
    reply = f"You said: {user_message}"
    return jsonify({'reply': reply})
```

---

## Accessibility

This component is designed for WCAG 2.1 AA compliance:

- **Contrast**: All text on the dark hero background is white (#fff) on deep navy (~12:1 ratio). Chat bubbles use #1a1a2e on white (~14:1).
- **Touch targets**: All buttons (chips, send) have a minimum 44px height.
- **Keyboard navigation**: Tab order flows chips → input → send. The decorative avatar is `aria-hidden` and `focusable="false"` — it's skipped entirely.
- **Screen readers**: Message log has `role="log"` and `aria-live="polite"`. Form input has a visually hidden `<label>`. Send button has `aria-label`.
- **Reduced motion**: Breathing and blink animations only run under `@media (prefers-reduced-motion: no-preference)`.
- **High contrast mode**: `@media (forced-colors: active)` strips the decorative background and uses system colors.
- **Font size**: 18px base (1.125rem) — comfortable for the 30–70 age demographic.

---

## Responsive Behavior

| Breakpoint | Avatar Height | Notes |
|-----------|--------------|-------|
| Mobile (<768px) | 100px | Tighter padding, smaller chips |
| Tablet (768–1023px) | 120px | Moderate glow orb |
| Desktop (≥1024px) | 180px | Full scene effects |

---

## Browser Support

- Chrome/Edge 88+
- Firefox 78+
- Safari 14+
- No IE11 support (uses CSS custom properties, `inset`, flexbox gap)

---

## Quick Test

Open `index.html` directly in your browser — no server needed. Click chips or type a message to see the mock chat in action.
