import { isMainThread, parentPort, workerData } from 'worker_threads';
import chalk from 'chalk';
import { Headers } from 'node-fetch';
import fetch from 'node-fetch';
import linq from 'linq';


//adding useragent to avoid ip bans
const headers = new Headers();
headers.append('User-Agent', 'TikTok 26.2.0 rv:262018 (iPhone; iOS 14.4.2; en_US) Cronet');
const headersWm = new Headers();
headersWm.append('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36');


const getIdVideo = (url) => {
    const matching = url.includes("/video/")
    if (!matching) {
        console.log(chalk.red("[X] Error: URL not found"));
        process.exit();
    }
    const idVideo = url.substring(url.indexOf("/video/") + 7, url.length);
    return (idVideo.length > 19) ? idVideo.substring(0, idVideo.indexOf("?")) : idVideo;
}

const getVideoNoWM = async (url) => {
    const idVideo = await getIdVideo(url)
    const API_URL = `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${idVideo}`;
    const request = await fetch(API_URL, {
        method: "GET",
        headers: headers
    });
    const body = await request.text();
    try {
        var res = JSON.parse(body);
    } catch (err) {
        console.error("Error:", err);
        console.error("Response body:", body);
    }
    const urlMedia = res.aweme_list[0].video.play_addr.url_list[0]
    let photo_displays = [];
    let photo_urls = [];    
    if (res.aweme_list[0].image_post_info != undefined && res.aweme_list[0].image_post_info.images != undefined) {
        photo_displays = linq.from(res.aweme_list[0].image_post_info.images).select(x => x.display_image).toArray();
        photo_urls = linq.from(photo_displays).select(x => x.url_list[1]).toArray();
    }
    const data = {
        url: urlMedia,
        id: idVideo,
        photo_urls: photo_urls
    }
    return data
}


if (!isMainThread) {
    if (!isMainThread) {
        var result = [];
        for (let i = 0; i < workerData.length; i++) {
            const element = await getVideoNoWM(workerData[i]);
            result.push(element);
        }
        parentPort.postMessage(result);
    }
}