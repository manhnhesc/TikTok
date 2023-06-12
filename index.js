import fetch from 'node-fetch';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs';
import puppeteer from 'puppeteer';
import { exit } from 'process';
import PQueue from 'p-queue';
// import { resolve } from 'path';
// import pkg from 'lodash';
// const { reject } = pkg;
import { Headers } from 'node-fetch';
import readline from 'readline';
import { Worker } from 'worker_threads';


//adding useragent to avoid ip bans
const headers = new Headers();
headers.append('User-Agent', 'TikTok 26.2.0 rv:262018 (iPhone; iOS 14.4.2; en_US) Cronet');
const headersWm = new Headers();
headersWm.append('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36');



const getChoice = () => new Promise((resolve, reject) => {
    inquirer.prompt([
        {
            type: "list",
            name: "choice",
            message: "Choose a option",
            choices: ["Mass Download with (txt)", "Mass Download (Username)", "Single Download (URL)"]
        },
        {
            type: "list",
            name: "type",
            message: "Choose a option",
            choices: ["With Watermark", "Without Watermark"]
        }
    ])
        .then(res => resolve(res))
        .catch(err => reject(err));
});

const getInput = (message) => new Promise((resolve, reject) => {
    inquirer.prompt([
        {
            type: "input",
            name: "input",
            message: message
        }
    ])
        .then(res => resolve(res))
        .catch(err => reject(err));
});

const generateUrlProfile = (username) => {
    var baseUrl = "https://www.tiktok.com/";
    if (username.includes("@")) {
        baseUrl = `${baseUrl}${username}`;
    } else {
        baseUrl = `${baseUrl}@${username}`;
    }
    return baseUrl;
};

const downloadMediaFromList = async (listVideo) => {
    console.log(chalk.yellow(`[!] Found ${listVideo.length} media for downloading`))
    if (listVideo != undefined && listVideo.length > 0) {
        //number videos per thread
        const c = 5;
        const threads = new Set();
        var results = [];
        let l = Math.ceil(listVideo.length / c);
        for (let i = 0; i < l; i++) {
            let elements = [];
            if (i == 0) {
                elements = listVideo.slice(i, c);
            } else {
                elements = listVideo.slice(i * c, (i + 1) * c);
            }
            threads.add(new Worker('./downloader', { workerData: elements }));
        }
        for (let worker of threads) {
            worker.on('error', (err) => { chalk.red(`[x] Thread downloader ${worker.threadId} error...\n`); });
            worker.on('exit', () => {
                console.log(chalk.green(`[+] Thread downloader ${worker.threadId} exiting...`));
                threads.delete(worker);
                if (threads.size === 0) {
                    results.push('\n');
                }
            })
            worker.on('message', (msg) => {
                console.log(chalk.green(`[+] Thread downloader ${worker.threadId} running...`));
                results.push(msg);
            });

        }
    }
    return results;
}

const workerGetWatermarkRunning = async (data) => {
    return new Promise((resolve) => {
        try {
            const worker = new Worker('./fullWatermarkGetter', { workerData: data });
            worker.on('error', (err) => { console.log(chalk.red(`[x] Thread #${worker.threadId} error: ${err}`)); });
            worker.on('message', (msg) => {
                console.log(chalk.green(`[+] Thread #${worker.threadId} running...`));
                resolve(msg);
            });
            worker.on('exit', (msg) => {
                console.log(chalk.red(`[-] Thread #${worker.threadId} exiting...`));
            });

        } catch (error) {
            console.log(chalk.red(`[x] Thread #${worker.threadId} error: ${error}`));
        }
    });
}

const workerGetNoWatermarkRunning = async (data) => {
    return new Promise((resolve) => {
        try {
            const worker = new Worker('./noWatermarkGetter', { workerData: data });
            worker.on('error', (err) => { console.log(chalk.red(`[x] Thread #${worker.threadId} error: ${err}`)); });
            worker.on('message', (msg) => {
                console.log(chalk.green(`[+] Thread #${worker.threadId} running...`));
                resolve(msg);
            });
            worker.on('exit', (msg) => {
                console.log(chalk.red(`[-] Thread exiting...`));
            });

        } catch (error) {
            console.log(chalk.red(`[x] Thread #${worker.threadId} error: ${error}`));
        }
    });
}



const getMediaInfoFromList = async (listVideo, type) => {
    return new Promise((resolve) => {
        const c = 5;
        let results = [];
        let l = Math.ceil(listVideo.length / c);
        const queue = new PQueue({ concurrency: 1 });

        for (let i = 0; i < l; i++) {
            let elements = [];
            if (i == 0) {
                elements = listVideo.slice(i, c);
            } else {
                elements = listVideo.slice(i * c, (i + 1) * c);
            }
            if (type == "With Watermark")
                queue.add(() => workerGetWatermarkRunning(elements));
            else
                queue.add(() => workerGetNoWatermarkRunning(elements));
        }
        queue.on('completed', qResult => {
            results = results.concat(qResult);
            resolve(results)
        });
    });
}



const getListVideoByUsername = async (username) => {
    var baseUrl = await generateUrlProfile(username)
    const browser = await puppeteer.launch({
        headless: false,
    })
    const page = await browser.newPage()
    page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4182.0 Safari/537.36"
    );
    await page.goto(baseUrl)
    var listVideo = []
    console.log(chalk.green("[+] Getting list video from: " + username))
    var loop = true
    while (loop) {
        listVideo = await page.evaluate(() => {
            const listVideo = Array.from(document.querySelectorAll(".tiktok-yz6ijl-DivWrapper > a"));
            return listVideo.map(item => item.href);
        });
        console.log(chalk.yellow(`[!] ${listVideo.length} video found`))
        previousHeight = await page.evaluate("document.body.scrollHeight");
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await page.waitForFunction(`document.body.scrollHeight > ${previousHeight}`, { timeout: 10000 })
            .catch(() => {
                console.log(chalk.red("[X] No more video found"));
                console.log(chalk.yellow(`[!] Total video found: ${listVideo.length}`))
                loop = false
            });
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    await browser.close()
    return listVideo
}
const getRedirectUrl = async (url) => {
    if (url.includes("vm.tiktok.com") || url.includes("vt.tiktok.com")) {
        url = await fetch(url, {
            redirect: "follow",
            follow: 10,
        });
        url = url.url;
        console.log(chalk.yellow("[!] Redirecting to: " + url));
    }
    return url;
}



(async () => {
    const choice = await getChoice();
    var listVideo = [];
    var listMedia = [];
    if (choice.choice === "Mass Download (Username)") {
        const usernameInput = await getInput("Enter the username with @ (e.g. @username) : ");
        const username = usernameInput.input;
        listVideo = await getListVideoByUsername(username);
        if (listVideo.length === 0) {
            console.log(chalk.red("[x] Error: No video found"));
            exit();
        }
    } else if (choice.choice === "Mass Download with (txt)") {
        var urls = [];
        // Get URL from file
        const fileInput = await getInput("Enter the file path : ");
        const file = fileInput.input + '.txt';

        if (!fs.existsSync(file)) {
            console.log(chalk.red("[X] Error: File not found"));
            exit();
        }

        // read file line by line
        const rl = readline.createInterface({
            input: fs.createReadStream(file),
            crlfDelay: Infinity
        });

        for await (const line of rl) {
            urls.push(line);
            console.log(chalk.yellow(`[!] Found URL: ${line}`));
        }


        for (var i = 0; i < urls.length; i++) {
            const url = await getRedirectUrl(urls[i]);
            listVideo.push(url);
        }
    } else {
        const urlInput = await getInput("Enter the URL : ");
        const url = await getRedirectUrl(urlInput.input);
        listVideo.push(url);
    }

    console.log(chalk.yellow(`[!] Found ${listVideo.length} video`));

    //send to getter function

    // for (var i = 0; i < listVideo.length; i++) {
    //     console.log(chalk.green(`[*] Downloading video ${i + 1} of ${listVideo.length}`));
    //     console.log(chalk.green(`[*] URL: ${listVideo[i]}`));
    //     var data = (choice.type == "With Watermark") ? await getVideoWM(listVideo[i]) : await getVideoNoWM(listVideo[i]);

    // }
    var data = await getMediaInfoFromList(listVideo, choice.type).then(x => { return x; });
    listMedia = listMedia.concat(data);

    //send to downloader function
    if (listMedia != undefined && listMedia.length > 0)
        downloadMediaFromList(listMedia)
            .then(() => {
                console.log(chalk.green("[+] Sent download list successfully"));
            })
            .catch(err => {
                console.log(chalk.red("[X] Error: " + err));
            });


})();
