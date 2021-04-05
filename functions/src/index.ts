import * as functions from "firebase-functions"
import * as puppeteer from "puppeteer"
import * as Url from "url"

import * as admin from "firebase-admin"
admin.initializeApp()
const db = admin.firestore()

export async function verifyToken(request: functions.Request): Promise<false | admin.auth.DecodedIdToken> {
  try {
    const token: string | undefined = await getToken(request)

    if (!token) {
      return false
    }

    const payload: admin.auth.DecodedIdToken = await admin.auth().verifyIdToken(token)
    return payload !== null && payload
  } catch (err) {
    console.error(err)
    return false
  }
}
async function getToken(request: functions.Request): Promise<string | undefined> {
  if (!request.query.authorization) {
    return undefined
  }

  const token: string = String(request.query.authorization).replace(/^Bearer\s/, "")

  return token
}
// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

export const helloWorld = functions.https.onRequest(async (request, response) => {
  functions.logger.info("Hello logs!", { structuredData: true })
  const token = await verifyToken(request)
  if (!token) {
    response.status(403).send(`You need to login to use this service`)
    return
  }
  response.send(`Hello from Firebase, ${token.email}!`)
})

const LOAD_URL = "loadUrl"
const CLICK = "click"
const NEXT_PAGE = "nextPage"
const SCREENSHOT = "screenshot"
const ENTER_TEXT = "enterText"
const SELECT = "select"
const CONDITIONAL = "conditional"
type Action =
  | ["loadUrl", string]
  | ["click", string]
  | ["nextPage", string]
  | ["screenshot"]
  | ["enterText", string, string]
  | ["select", string, string]
  | ["conditional", () => Promise<boolean>, Action[]]

export const report = functions.runWith({ memory: "2GB", timeoutSeconds: 60 }).https.onRequest(async (req, res) => {
  const token = await verifyToken(req)
  if (!token) {
    res.status(403).send("You need to login")
    return
  }
  const startAt = new Date().getTime()
  functions.logger.info("Hello logs!", { structuredData: true })

  let browser
  try {
    // [START puppeteer-block]
    // launch Puppeteer and start a Chrome DevTools Protocol (CDP) session
    // with performance tracking enabled.
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox"],
    })
    const page = await browser.newPage()
    await page.setDefaultNavigationTimeout(0)
    await page.setViewport({ width: 1440, height: 1440 })

    const {
      title = "",
      firstName = "",
      lastName = "",
      email = "",
      emailType = "Work",
      phone = "",
      phoneType = "Home",
      serviceRequestDetails = "",
    } = await db
      .collection("users")
      .doc(token.uid)
      .get()
      .then((doc) => doc.data() as { [key: string]: string })
    const formsets: { [key: string]: Action[] } = {
      overflowingTrashBin: [
        [LOAD_URL, "https://secure.toronto.ca/webwizard/html/litter_bin_overflow.htm"],
        [CLICK, "fieldset #agree10"],
        [NEXT_PAGE, "#layout > #content > form > .buttons > .start"],
        [CLICK, "fieldset #agreeTerms0"],
        [NEXT_PAGE, "#layout > #content > form > .buttons > .next"],

        [CLICK, "fieldset #useIntersectionSearch0"],
        [ENTER_TEXT, "form #probCrossStreet1", req.query.crossStreet1 as string],
        [ENTER_TEXT, "form #probCrossStreet2", req.query.crossStreet2 as string],
        [ENTER_TEXT, "form #probLocationDetails", req.query.locationDetails as string],

        [ENTER_TEXT, "form #ctctTitle", title],
        [ENTER_TEXT, "form #ctctFirstName", firstName],
        [ENTER_TEXT, "form #ctctLastName", lastName],
        [ENTER_TEXT, "form #ctctEmail", email],
        [SELECT, "form #ctctEmailType", emailType],
        [ENTER_TEXT, "form #ctctPhoneNumb", phone],
        [SELECT, "form #ctctPhoneNumbType", phoneType],
        [NEXT_PAGE, "#layout > #content > form > .buttons > .next"],
        // confirm page?
        [
          CONDITIONAL,
          async () => {
            const content = await page.content()
            return content.indexOf("Multiple intersections match your entry. Please select one from the list below") > 0
          },
          [[NEXT_PAGE, "#layout > #content > form > .buttons > .next"]],
        ],
        [ENTER_TEXT, "form #additional_information", serviceRequestDetails],
        [NEXT_PAGE, "#layout > #content > form > .buttons > .next"],
        [SCREENSHOT],
      ],
    }
    const pageActions = formsets[req.query.reportType as string]

    if (!pageActions) {
      res.status(400).send("Please specify a valid Report Type")
    }
    /*

  await page.waitForSelector('#layout > #content > form > .buttons > .next')
  await page.click('#layout > #content > form > .buttons > .next')

  await navigationPromise

  await page.waitForSelector('form #additional_information')
  await page.click('form #additional_information')

  await page.waitForSelector('#layout > #content > form > .buttons > .next')
  await page.click('#layout > #content > form > .buttons > .next')

  await navigationPromise

  await page.waitForSelector('#layout > #content > form > .buttons > .back')
  await page.click('#layout > #content > form > .buttons > .back')

  await navigationPromise

  await browser.close()
})()
       */

    const screenshots: string[] = []
    for (const pageAction of pageActions) {
      switch (pageAction[0]) {
        case LOAD_URL: {
          const [, passedURL] = pageAction
          const url = Url.parse(passedURL)
          if (!url || !url.hostname) {
            console.error("Valid URL to trace not specified")
            res.status(400).send("Please specify a valid URL to trace")
            return
          }
          // browse to the page, capture and write the performance metrics
          console.log("Fetching url: " + url.href)
          await page.goto(url.href!, {
            waitUntil: "networkidle0",
          })

          break
        }
        case CLICK: {
          const [, selector] = pageAction
          await page.waitForSelector(selector)
          console.log(`Click target ${selector} found`)
          await page.click(selector)
          console.log(`Click target ${selector} clicked`)
          break
        }
        case NEXT_PAGE: {
          const [, selector] = pageAction
          await page.waitForSelector(selector)
          console.log(`Next page button ${selector} found`)
          screenshots.push(
            (await page.screenshot({
              type: "jpeg",
              encoding: "base64",
              quality: 50,
            })) as string
          )
          console.log("Page screenshotted")
          await page.click(selector)
          console.log(`Next page button ${selector} clicked`)
          try {
            await page.waitForNavigation({
              timeout: 3000,
              waitUntil: "networkidle0",
            })
          } catch (e) {
            console.error("waitForNavigation timed out")
          }
          break
        }
        case ENTER_TEXT: {
          const [, selector, input] = pageAction
          await page.waitForSelector(selector)
          console.log(`Text entry ${selector} loaded`)
          await page.click(selector)
          console.log(`Text entry ${selector} clicked`)
          await page.type(selector, input)
          console.log(`Text entry ${selector} filled with ${input}`)
          break
        }
        case SELECT: {
          const [, selector, input] = pageAction
          await page.waitForSelector(selector)
          console.log(`Select ${selector} loaded`)
          await page.click(selector)
          console.log(`Select ${selector} clicked`)
          await page.select(selector, input)
          console.log(`Select ${selector} selected ${input}`)
          break
        }
        case SCREENSHOT: {
          screenshots.push(
            (await page.screenshot({
              type: "jpeg",
              encoding: "base64",
              quality: 50,
            })) as string
          )
          console.log("Page screenshotted")
          break
        }
        case "conditional": {
          const [, conditional, actions] = pageAction
          const run = await conditional()
          console.log("Conditional evaluated")
          if (run) {
            actions
          }
          console.log("Actions run")
          break
        }
      }
    }

    await browser.close()

    res.status(200).send(`<html>
        <head></head>
            <body>
                <p>Run in ${(new Date().getTime() - startAt) / 1000} Seconds</p>
                ${screenshots.map((ssData1) => `<img src="data:image/jpeg;base64, ${ssData1}"/>`).join("\n")}
            </body>
      </html>
      `)
  } catch (e) {
    console.error("Caught Error: " + e)
    res.status(500).send(e)
  } finally {
    if (browser) {
      await browser.close()
    }
  }
})
