import chalk from 'chalk';
import { isMainThread, parentPort, workerData } from 'worker_threads';
import { Headers } from 'node-fetch';
import fetch from 'node-fetch';
import { resolve } from 'path';

import pkg from 'lodash';
const { reject } = pkg;
import fs from 'fs';


const headers = new Headers();
headers.append('User-Agent', 'TikTok 26.2.0 rv:262018 (iPhone; iOS 14.4.2; en_US) Cronet');
const headersWm = new Headers();
headersWm.append('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36');


const downloadMediaFromList = async (list) => {
    var results = false;
    const folder = resolve() + "/downloads/";

    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder);
    }


    list.forEach((item) => {
        try {

            if (item.url != undefined) {
                const fileName = `${item.id}.mp4`
                const downloadFile = fetch(item.url, { headers: headers });
                const file = fs.createWriteStream(folder + fileName)
                downloadFile.then(res => {
                    res.body.pipe(file)
                    file.on("finish", () => {
                        file.close()
                        console.log(chalk.green(`[+] Downloaded: ${resolve(fileName)} `));
                    });
                    file.on("error", (err) => {
                        console.log(chalk.red(`[-] ${reject(err)} `));
                    });

                });
                if (item.photo_urls != undefined && item.photo_urls.length > 0) {
                    var c = 1;
                    item.photo_urls.forEach(nestItem => {
                        const fileName = `${item.id}_${c}.jpeg`
                        const downloadFile = fetch(nestItem)
                        const file = fs.createWriteStream(folder + fileName)

                        downloadFile.then(res => {
                            res.body.pipe(file);
                            file.on("finish", () => {
                                file.close();
                                console.log(chalk.green(`[+] Downloaded: ${resolve(fileName)} `));
                            });
                            file.on("error", (err) => {
                                console.log(chalk.red(`[-] ${reject(err)} `));
                            });
                        });
                        c += 1;
                    });
                }


            } else {
                if (item.photo_urls != undefined && item.photo_urls.length > 0) {
                    var c = 1;
                    item.photo_urls.forEach(nestItem => {
                        const fileName = `${item.id}_${c}.jpeg`
                        const downloadFile = fetch(nestItem)
                        const file = fs.createWriteStream(folder + fileName)

                        downloadFile.then(res => {
                            res.body.pipe(file);
                            file.on("finish", () => {
                                file.close()
                                console.log(chalk.green(`[+] Downloaded: ${resolve(fileName)} `));
                            });
                            file.on("error", (err) => {
                                console.log(chalk.red(`[-] ${reject(err)} `));
                            });
                        });
                        c += 1;
                    });
                }
            }

        } catch (error) {
            console.log(chalk.red(`[-] ${reject(error)} `));
        }
    });
    results = true;
    return results;
}
if (!isMainThread) {
    parentPort.postMessage(await downloadMediaFromList(workerData));
}