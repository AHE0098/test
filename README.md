# Mobile Quiz (Cloud Template)

This project is designed to be **plug-and-play**:
- Update **questions.js** to change the quiz
- Update **config.js** to tweak game rules
- Deploy runs in the cloud (Render / Railway / etc.)

## Files you usually touch
- `questions.js`
- `config.js`
- (optional) `public/ui-config.js` for sounds/timer smoothness

## Deploy (Render quick steps)
1. Create a GitHub repo and upload these files.
2. In Render: New -> Web Service -> connect the repo.
3. Build command: `npm install`
4. Start command: `npm start`
5. Deploy and open the service URL on your phones.

## Verify deploy
- Check the version badge in the UI equals `CFG.QUIZ_VERSION` from `config.js`.
