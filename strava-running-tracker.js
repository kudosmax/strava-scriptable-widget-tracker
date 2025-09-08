// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: running;

const EVENT_NAME = "Running Tracker";
const GOAL_DAYS = 365;

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

const PADDING = 4;
const CIRCLE_SIZE = 5.5;
const CIRCLE_SPACING = 3.5;
const TEXT_SPACING = 6;

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
    
    let allActivities = [];
    let page = 1;
    const perPage = 200;

    while (true) {
      const url = callActivities + accessToken + `&after=${since}&per_page=${perPage}&page=${page}`;
      const activities = await new Request(url).loadJSON();
      if (activities.length === 0) {
        break;
      }
      allActivities = allActivities.concat(activities);
      page++;
    }
    
    const runData = {};
    const runningActivities = allActivities.filter(activity => activity.type === "Run");
    
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

// Layout calc
const WIDGET_WIDTH = 320;
const AVAILABLE_WIDTH = WIDGET_WIDTH - 2 * PADDING;
const TOTAL_CIRCLE_WIDTH = CIRCLE_SIZE + CIRCLE_SPACING;
const COLUMNS = Math.floor(AVAILABLE_WIDTH / TOTAL_CIRCLE_WIDTH);
const ROWS = Math.ceil(GOAL_DAYS / COLUMNS);
const gridWidth = COLUMNS * TOTAL_CIRCLE_WIDTH - CIRCLE_SPACING;

widget.setPadding(10, PADDING, 10, PADDING);

// Grid - 자동 중앙 정렬
const gridContainer = widget.addStack();
gridContainer.layoutVertically();

const gridRow = gridContainer.addStack();
gridRow.layoutHorizontally();
gridRow.addSpacer(); // 자동 좌측 여백

const gridStack = gridRow.addStack();
gridStack.layoutVertically();
gridStack.spacing = CIRCLE_SPACING;

gridRow.addSpacer(); // 자동 우측 여백

for (let row = 0; row < ROWS; row++) {
  const rowStack = gridStack.addStack();
  rowStack.layoutHorizontally();

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

// Footer - 자동 정렬
const footer = widget.addStack();
footer.layoutHorizontally();
footer.addSpacer(); // 자동 좌측 여백

const footerContent = footer.addStack();
footerContent.layoutHorizontally();
footerContent.size = new Size(gridWidth, 0);

const eventText = footerContent.addText(EVENT_NAME);
eventText.font = MENLO_BOLD;
eventText.textColor = COLOR_FILLED;

footerContent.addSpacer();

const daysText = `${daysCompleted}/${GOAL_DAYS} days`;
const daysLeft = footerContent.addText(daysText);
daysLeft.font = MENLO_REGULAR;
daysLeft.textColor = COLOR_UNFILLED;

footer.addSpacer(); // 자동 우측 여백

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  widget.presentMedium();
}
Script.complete();