// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: running;

const EVENT_NAME = "🏃‍♂️‍➡️";
const GOAL_DAYS = 270;

let clientID, clientSecret, refreshToken
let widgetInput = args.widgetParameter

if (widgetInput !== null) {
  [clientID, clientSecret, refreshToken] = widgetInput.split("|");

  if (!clientID || !clientSecret || !refreshToken) {
    throw new Error("Invalid parameter. Expected format: clientID|ClientSecret|RefreshToken")
  }

} else {
  throw new Error("No parameters set. Please insert your parameters like this: clientID|ClientSecret|RefreshToken")
}

const BG_IMAGE_URL = "";
const BG_COLOR = "#064e3b";
const BG_OVERLAY_OPACITY = 0.6;
const COLOR_FILLED = new Color("#4ade80");
const COLOR_UNFILLED = new Color("#4ade80", 0.15);

const PADDING = 8;
const CIRCLE_SIZE = 6;
const CIRCLE_SPACING = 4;
const TEXT_SPACING = 8;
const DOT_SHIFT_LEFT = 2;
const YEAR_OFFSET = DOT_SHIFT_LEFT - 2;
const DAYS_LEFT_OFFSET = 0;

const MENLO_REGULAR = new Font("Menlo", 12);
const MENLO_BOLD = new Font("Menlo-Bold", 12);

function getLocalDateString(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

const callActivities = `https://www.strava.com/api/v3/athlete/activities?access_token=`
const apiURL = (clientID, clientSecret, refreshToken) => `https://www.strava.com/oauth/token?client_id=${clientID}&client_secret=${clientSecret}&refresh_token=${refreshToken}&grant_type=refresh_token`

const saveStravaData = (data) => {
	let fm = FileManager.iCloud();
	let path = fm.joinPath( fm.documentsDirectory(), 'strava-running-tracker.json' );
	fm.writeString(path, JSON.stringify(data));
};

const getSavedStravaData = () => {
	let fm = FileManager.iCloud();
	let path = fm.joinPath(fm.documentsDirectory(), 'strava-running-tracker.json');
	let data = fm.readString( path );
	return JSON.parse(data);
};

async function loadFullStravaData(clientID, clientSecret, refreshToken) {
  try {
    const req = new Request(apiURL(clientID, clientSecret, refreshToken))
    req.method = "POST"
    let response = await req.loadJSON()
    const accessToken = response.access_token

    if (!accessToken) {
      return getSavedStravaData();
    }

    const since = Math.floor((Date.now() - GOAL_DAYS * 24 * 60 * 60 * 1000) / 1000);
    const dataComplete = await new Request(callActivities + accessToken + `&after=${since}&per_page=200`).loadJSON()
    
    const runData = {};
    const runningActivities = dataComplete.filter(activity => activity.type === "Run");
    
    runningActivities.forEach(activity => {
      const date = getLocalDateString(new Date(activity.start_date));
      runData[date] = true;
    });
    
    saveStravaData(runData);
    return runData;

  } catch (e) {
    return getSavedStravaData();
  }
}

const stravaRunData = await loadFullStravaData(clientID, clientSecret, refreshToken);

const currentDate = new Date();
const timelineDates = [];
for (let i = GOAL_DAYS - 1; i >= 0; i--) {
  const d = new Date(currentDate);
  d.setDate(d.getDate() - i);
  const dateStr = getLocalDateString(d);
  timelineDates.push(dateStr);
}

const daysCompleted = timelineDates.filter((date) =>
  stravaRunData[date]
).length;

const widget = new ListWidget();

if (BG_IMAGE_URL) {
  try {
    const req = new Request(BG_IMAGE_URL);
    const bgImage = await req.loadImage();
    widget.backgroundImage = bgImage;
  } catch (e) {
    console.log("Couldn't load background image");
  }
}

const overlay = new LinearGradient();
overlay.locations = [0, 1];
overlay.colors = [
  new Color(BG_COLOR, BG_OVERLAY_OPACITY),
  new Color(BG_COLOR, BG_OVERLAY_OPACITY),
];
widget.backgroundGradient = overlay;

const WIDGET_WIDTH = 320;
const AVAILABLE_WIDTH = WIDGET_WIDTH - 2 * PADDING;
const TOTAL_CIRCLE_WIDTH = CIRCLE_SIZE + CIRCLE_SPACING;
const COLUMNS = Math.floor(AVAILABLE_WIDTH / TOTAL_CIRCLE_WIDTH);
const ROWS = Math.ceil(GOAL_DAYS / COLUMNS);

widget.setPadding(12, PADDING, 12, PADDING);

const gridContainer = widget.addStack();
gridContainer.layoutVertically();

const gridStack = gridContainer.addStack();
gridStack.layoutVertically();
gridStack.spacing = CIRCLE_SPACING;

for (let row = 0; row < ROWS; row++) {
  const rowStack = gridStack.addStack();
  rowStack.layoutHorizontally();
  rowStack.addSpacer(DOT_SHIFT_LEFT);

  for (let col = 0; col < COLUMNS; col++) {
    const dotIndex = row * COLUMNS + col;
    if (dotIndex >= GOAL_DAYS) continue;

    const circle = rowStack.addText("■");
    circle.font = Font.systemFont(CIRCLE_SIZE);

    const date = timelineDates[dotIndex];
    const hasRun = stravaRunData[date];
    circle.textColor = hasRun ? COLOR_FILLED : COLOR_UNFILLED;

    if (col < COLUMNS - 1) rowStack.addSpacer(CIRCLE_SPACING);
  }
}

widget.addSpacer(TEXT_SPACING);

const footer = widget.addStack();
footer.layoutHorizontally();

const eventStack = footer.addStack();
eventStack.addSpacer(YEAR_OFFSET);
const eventText = eventStack.addText(EVENT_NAME);
eventText.font = MENLO_BOLD;
eventText.textColor = COLOR_FILLED;

const daysText = `${daysCompleted}/${GOAL_DAYS} days`;

const textWidth = daysText.length * 7.5;
const availableSpace =
  WIDGET_WIDTH - PADDING * 2 - YEAR_OFFSET - eventText.text.length * 7.5;
const spacerLength = availableSpace - textWidth + DAYS_LEFT_OFFSET;

footer.addSpacer(spacerLength);

const daysTextStack = footer.addStack();
const daysLeft = daysTextStack.addText(daysText);
daysLeft.font = MENLO_REGULAR;
daysLeft.textColor = COLOR_UNFILLED;

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  widget.presentMedium();
}
Script.complete();