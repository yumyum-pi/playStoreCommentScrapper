const puppeteer = require('puppeteer');
const otcsv = require('objects-to-csv');
const fs = require('fs');

let rawdata = fs.readFileSync('config.json');
let apps = JSON.parse(rawdata);

const outPutfilePath = './resource/csv/main.csv';
var waitingInterval = 250;
var waitingDotNo = 3;
var processNo,currentProcess, appNo,currentApp, currentStep, stepStatus, waiting;
var processLength = 2;

function writeProgress() {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write('> '+ processNo + ':' + currentProcess + ':' + appNo + currentApp + currentStep  + ':' + stepStatus + waiting);
}

function changeProcessNo(index) {
    processNo = "[" + index + "/" + processLength + "]";
}

function changeApp(index){
    appNo = "[" + (index + 1)  + "/" + apps.length + "]";
    currentApp = "@" + apps[index].name;
}

async function autoScroll(page){
    await page.evaluate(async () => {
        await new Promise( (resolve, reject) => {
            var totalHeight = 0;
            var distance = 200;
            var timer = setInterval(async () => {
                var scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if(totalHeight >= scrollHeight){
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}

const scrapeData = (app) => {
    return new Promise(async (res, rej) => {
        const browser = await puppeteer.launch({
            headless: true
        });
        try {
            currentStep = "/scrapping";
            stepStatus="STARTING";
            var timer = setInterval(() => {
                waiting+= "."
                if(waiting.length > waitingDotNo ) {
                    waiting = '';
                }
                writeProgress()
            }, waitingInterval);
            const page = await browser.newPage();
            await page.goto(app.url);
            page.setViewport({
                width: 1280,
                height: 1080,
            });
            
            await autoScroll(page);
    
           // const button = await page.$('div.PFAhAf');
            // button.click();
            
            // scrapping data
            const data = await page.evaluate((app) => {
                var info = [];
                var divs = document.querySelectorAll('div[jscontroller=H6eOGe]');
            
                divs.forEach((div) => {
                    const appName = app.name;
                    const name = div.querySelector('div.kx8XBd span.X43Kjb').innerText;
                    const stars = div.querySelectorAll('div.bUWb7c.vQHuPe').length;
                    const helpfull = div.querySelector('div.jUL89d.y92BAb').innerText;
                    var comments = div.querySelector('span[jsname=fbQN7e]').innerText;
                    if (comments === '') {
                        comments = div.querySelector('span[jsname=bN97Pc]').innerText;
                    }
                    info.push({ appName ,name, stars, helpfull, comments});
                });
                return info;
            }, app);
    
            
            await browser.close();
            clearInterval(timer);
            waiting = '';
            stepStatus="COMPLETE";
            writeProgress();
            res (data);
        } catch (error) {
            await browser.close();
            rej (error);
        }
    });
}

const getData = () => {
    return new Promise(async (resolve, reject) => {
        var collection = []
        try {
            for (var index = 0; index < apps.length; index++) {
                const app = apps[index];
                changeApp(index);
                writeProgress()
                const data = await scrapeData(app);
                collection = collection.concat(data);
            }
        } catch (error) {
            reject(error);
            return;
        }
        resolve(collection);
    });
};

async function start() {
    console.log('> STARTING TASK...');
    //processNo,currentProcess, appNo,currentApp, currentStep, stepStatus, waiting;
    changeProcessNo(1);
    currentProcess = "Get Data";
    writeProgress();

    try { 
        //staring getting data;
        await getData()
            .then(result => {
                changeProcessNo(2);
                currentProcess = "Write File";
                appNo = currentApp = currentStep = '';
                stepStatus="STARTING";
                writeProgress();
                var timer = setInterval(() => {
                    waiting+= "."
                    if(waiting.length > waitingDotNo ) {
                        waiting = '';
                    }
                    writeProgress()
                }, waitingInterval);
                
                const transformed = new otcsv(result);
                transformed.toDisk(outPutfilePath);
                stepStatus="COMPLETE";
                clearInterval(timer);
                waiting = '';
                writeProgress();
                return result.length;
            })
            .then((len) => {
                console.log("\n> TASK: COMPLETE & SUCCESSFULL");
                console.log("Total No of files: " + len);
            });
    } catch (error) {
        console.log(error);
    }
}

start();
