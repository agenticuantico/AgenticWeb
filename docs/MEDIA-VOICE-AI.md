# Media, voice and AI integrations

## Uploads

AgenticWeb now uploads images, video, audio, PDF and common documents to Cloudflare R2 through `POST /v1/uploads`.

The Worker expects an R2 binding named `UPLOADS` and the Wrangler configuration points to:

`agenticuantico-uploads`

Create it once in the Cloudflare account:

```bash
npx wrangler r2 bucket create agenticuantico-uploads
```

Then deploy the Worker normally.

The current Worker upload limit is 100 MB per file, matching the standard Cloudflare request-body ceiling on Free/Pro plans. For larger videos, the next step is the R2 multipart upload flow.

## Image generation

The composer includes an image-generation action. It calls:

`POST /v1/public/image-generation`

and uses Cloudflare Workers AI with:

`@cf/black-forest-labs/flux-2-klein-4b`

No provider secret is exposed to the browser.

## Voice

Automatic response speech is **OFF by default**. The user can turn it ON/OFF from the composer or voice panel.

The voice panel can enumerate voices actually installed by the browser/device and includes a preview button. The microphone remains a separate input feature.

## Provider independence

The frontend keeps the model behind the existing Worker API. Cloudflare Workers AI is the fast fallback, while the existing Hugging Face route remains available for chat/vision and future image/video providers. GitHub/Cloudflare/Hugging Face credentials stay server-side.
