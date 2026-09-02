# Live study alerts

Live study alerts are an opt-in preview feature for classes, lectures, and
meetings. Free Meet Notes watches finalized local transcript segments for:

- deadlines and submission times;
- requests to write, read, submit, prepare, or bring something;
- questions directed to a named user or the class; and
- explicit key points, definitions, summaries, and exam hints.

Detection is deterministic and local. It does not call a hosted language model,
upload audio, or start a recording. Alerts arrive after the speech recognizer
finalizes a segment, so they are near-real-time rather than word-by-word.

## Connect a phone

1. In Free Meet Notes, open **Settings > Study alerts**.
2. Turn on **Live study alerts**.
3. Select the categories you want.
4. Choose **Create secure topic**.
5. Install the open-source **ntfy** app on iPhone or Android.
6. In ntfy, add a subscription on `ntfy.sh` and paste the generated topic.
7. Return to Free Meet Notes, enable phone alerts, and choose **Send test**.

This is a push notification, not carrier SMS. It does not require a phone number.
The desktop must be recording and connected to the internet for phone delivery.

## Privacy model

The feature is disabled by default. The random topic is stored in Windows
Credential Manager or the equivalent operating-system credential vault. Treat
the topic as a password: anyone who learns it may be able to subscribe. Replacing
the topic disconnects the old subscription.

The default **Category only** mode sends a generic message such as “A possible
deadline was mentioned.” It does not send transcript words. **Include short
excerpt** is more informative, but sends up to 360 characters of transcript-derived
text through the third-party `ntfy.sh` relay. Raw audio and the full transcript are
never sent by this feature.

Every publish request includes `Cache: no`, asking ntfy not to retain the alert in
its server-side message cache. This improves privacy but means an offline phone may
miss an alert. All `ntfy.sh` topics are publicly addressable; the randomly generated
UUID topic makes guessing impractical but is not account-backed authentication.
For sensitive environments, keep phone delivery disabled. A future branded relay
should use authenticated pairing and application-layer end-to-end encryption.

## Accuracy and responsible use

This feature is a reminder, not a source of truth. Background noise, accents,
speaker overlap, transcription errors, and ordinary classroom phrasing can cause
missed or incorrect alerts. Always check the transcript, syllabus, learning portal,
and the professor's written instructions.

Recording rules vary by school and jurisdiction. Inform participants and obtain
any required permission before recording. The feature must not be used to hide a
recording or bypass an instructor's or institution's policy.
