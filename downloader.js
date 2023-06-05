import { parentPort, workerData } from 'worker_threads';
import { Headers } from 'node-fetch';
import fs from 'fs';


const headers = new Headers();
headers.append('User-Agent', 'TikTok 26.2.0 rv:262018 (iPhone; iOS 14.4.2; en_US) Cronet');
const headersWm = new Headers();
headersWm.append('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36');


const downloadMediaFromList = async (list) => {
    var results = [];
    const folder = "downloads/"
    list.forEach((item) => {
        const fileName = `${item.id}.mp4`
        const downloadFile = fetch(item.url, { headers: headers });
        const file = fs.createWriteStream(folder + fileName)

        downloadFile.then(res => {
            res.body.pipe(file)
            file.on("finish", () => {
                file.close()
                var log = resolve(item);
                results.push(log);
            });
            file.on("error", (err) => {
                var log = reject(err)
                results.push(log);
            });
        });
    });
}

parentPort.postMessage(await downloadMediaFromList(workerData));