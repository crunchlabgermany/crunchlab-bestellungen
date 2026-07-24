/* eslint-disable jsx-a11y/media-has-caption, react/prop-types */
import { useEffect, useState } from "react";
import { Form } from "react-router";

export function TikTokUploadForm({ demo = false }) {
  const [preview, setPreview] = useState(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  return <Form method="post" encType="multipart/form-data" style={{display:"grid", gap:10}}>
    <input type="hidden" name="intent" value="upload"/>
    <label>Videodatei<input type="file" name="video" accept="video/mp4,video/quicktime" required onChange={(event) => { if (preview) URL.revokeObjectURL(preview); setPreview(event.target.files?.[0] ? URL.createObjectURL(event.target.files[0]) : null); }}/></label>
    {preview && <video src={preview} controls style={{width:"100%", maxWidth:520, maxHeight:360}}/>}
    <label>Caption<textarea name="caption" maxLength={2200} required placeholder={demo ? "Caption für das TikTok-Prüfvideo" : "Caption"}/></label>
    <label>Hashtags<input name="hashtags" placeholder="#crunchlab #muesli"/></label>
    {!demo && <label>Optional planen<input type="datetime-local" name="scheduledAt"/></label>}
    <button>Als TikTok-Entwurf hochladen</button>
    <button type="button" disabled>Direkt veröffentlichen</button>
    <small>Wird nach TikTok-Freigabe aktiviert</small>
  </Form>;
}
