import fetch from 'node-fetch';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs';
import puppeteer from 'puppeteer';
import { exit } from 'process';
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
                //console.log(chalk.green(`[+] Thread downloader ${worker.threadId} exiting...`));
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

const getMediaInfoFromList = async (listVideo, type) => {

    const c = 5;
    var actions = [];
    let results = [];
    let l = Math.ceil(listVideo.length / c);

    for (let i = 0; i < l; i++) {
        let elements = [];
        if (i == 0) {
            elements = listVideo.slice(i, c);
        } else {
            elements = listVideo.slice(i * c, (i + 1) * c);
        }
        if (type == "With Watermark")
            actions.push(new Promise((resolve) => {
                const worker = new Worker('./fullWatermarkGetter', { workerData: elements });
                try {
                    worker.on('error', (err) => { console.log(chalk.red(`[x] Thread #${worker.threadId} error: ${err}`)); });
                    worker.on('message', (msg) => {
                        console.log(chalk.green(`[+] Thread #${worker.threadId} running...`));
                        if (msg != undefined)
                            resolve(msg);
                    });
                    worker.on('exit', (msg) => {
                        console.log(chalk.red(`[-] Thread #${worker.threadId} exiting...`));
                    });

                } catch (error) {
                    console.log(chalk.red(`[x] Thread #${worker.threadId} error: ${error}`));
                }
            }));
        else
            actions.push(new Promise((resolve) => {
                const worker = new Worker('./noWatermarkGetter', { workerData: elements });
                try {
                    worker.on('error', (err) => { console.log(chalk.red(`[x] Thread #${worker.threadId} error: ${err}`)); });
                    worker.on('message', (msg) => {
                        console.log(chalk.green(`[+] Thread #${worker.threadId} running...`));
                        if (msg != undefined)
                            resolve(msg);
                    });
                    worker.on('exit', (msg) => {
                        console.log(chalk.red(`[-] Thread exiting...`));
                    });

                } catch (error) {
                    console.log(chalk.red(`[x] Thread #${worker.threadId} error: ${error}`));
                }
            }));
    }
    var p = Promise.all(actions).then(r => {
        let a = [];
        r.forEach(e => {
            a = a.concat(e);
        });
        return a;
    });
    results = await p.then(x => { return x; });
    return results;
}

const getListVideoByUsername = async (username) => {
    var baseUrl = await generateUrlProfile(username)
    const browser = await puppeteer.launch({
        headless: false,
        args: [`--window-size=800,600`],
        defaultViewport: {
            width: 800,
            height: 600
        }
    });
    const page = await browser.newPage()
    page.setUserAgent(
        //"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4182.0 Safari/537.36"
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
    );
    await page.goto(baseUrl);
    var listVideo = [];

    console.log(chalk.green("[+] Getting list video from: " + username));
    //console.log(chalk.green("[+] Verification capcha time: 10s"));

    var loop = true
    while (loop) {
        listVideo = await page.evaluate(() => {
            //const listVideo = Array.from(document.querySelectorAll(".tiktok-yz6ijl-DivWrapper > a"));
            const listVideo = Array.from(document.querySelectorAll(".tiktok-1s72ajp-DivWrapper > a"));
            return listVideo.map(item => item.href).filter(x => x.includes('/video/'));
        });
        console.log(chalk.yellow(`[!] ${listVideo.length} video found`))
        let previousHeight = await page.evaluate("document.body.scrollHeight");
        console.log("Previous Web Height: " + previousHeight);
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await page.waitForFunction(`document.body.scrollHeight > ${previousHeight}`, { timeout: 15000 })
            .catch(() => {
                console.log(chalk.red("[X] No more video found"));
                console.log(chalk.yellow(`[!] Total video found: ${listVideo.length}`))
                loop = false
            });
        await new Promise((resolve) => setTimeout(resolve, 3000));
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
    var fileInputName = '';
    if (choice.choice === "Mass Download (Username)") {
        const usernameInput = await getInput("Enter the username with @ (e.g. @username) : ");
        const username = usernameInput.input;
        listVideo = await getListVideoByUsername(username);
        if (listVideo.length === 0) {
            console.log(chalk.red("[x] Error: No video found"));
            process.exit();
        }
    } else if (choice.choice === "Mass Download with (txt)") {
        var urls = [];
        // Get URL from file
        const fileInput = await getInput("Enter the file path : ");
        const file = fileInput.input + '.txt';
        fileInputName = file;
        if (!fs.existsSync(file)) {
            console.log(chalk.red("[X] Error: File not found"));
            process.exit();
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

    var data = await getMediaInfoFromList(listVideo, choice.type);//.then(x => { return x; });
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


    console.log(chalk.yellow(`${fileInputName} Finished Download`));

})();
