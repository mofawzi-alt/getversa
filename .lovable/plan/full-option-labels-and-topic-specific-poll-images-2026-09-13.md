# Full option labels and topic-specific poll images

## Result labels
- Update the option labels attached to percentage bars on the main voting result card and the Home/Explore result popup.
- Remove ellipsis and one-line truncation only from those bar labels.
- Let labels wrap naturally to two lines, keep the percentage fixed and readable, and use a slightly smaller label size for unusually long text so the complete label remains visible.
- Keep the question text, image labels, percentages, spacing, colors, and all other result-screen behavior unchanged.

## AI-generated poll images
- Update all current poll-image generation paths so every prompt explicitly includes the poll question, fixed category, and the relevant option.
- Make the question and category define the main visual setting and objects. For example, Education should prioritize a university, classroom, library, books, or study environment.
- Remove rules that force a generic person into every image. Include people only when they clarify the poll topic or action; otherwise show the most relevant place, object, or activity.
- Preserve the existing Egyptian/MENA targeting, cultural context, option-specific contrast, cinematic photography, no text/logos, and no-alcohol rules.
- Apply this consistently to automatic AI polls, calendar image previews, and batch image generation.

## Verification
- Check long English and Arabic option labels at mobile width to confirm there is no ellipsis and percentages remain aligned.
- Deploy the updated image functions and run controlled image-generation checks to confirm the generated scene follows the question and category rather than defaulting to a neutral portrait.
- Existing saved poll images will remain unchanged; the new prompt rules apply to newly generated or regenerated images.
