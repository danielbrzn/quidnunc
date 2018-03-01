var request = require('request');
var parseString = require('xml2js').parseString;
var opn = require('opn');

function getProductLink(siteLink, keyword, cb) {
    console.log(siteLink + '/sitemap_products_1.xml');
        request({
                url: siteLink + '/sitemap_products_1.xml',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.88 Safari/537.36'
                },
                method: 'get'
            },
            function (err, res, body) {
                if (res.statusCode === parseInt('404')) {
                    console.log("Waiting 1.5s");
                    setTimeout(() => getProductLink(siteLink, keyword, cb), 1500);
                } else {
                    parseString(body, function (err, data) {
                        var arr = data.urlset.url;
                        for (var i = 0; i < arr.length; i++) {
                            var curLink = arr[i].loc[0];
                            if (curLink.includes(keyword)) {
                                getCartLink(curLink, siteLink, cb);
                                break;
                            }
                        }
                    })
                }
            });

}

function getCartLink(prodLink, siteLink, cb) {
    request({
            url: prodLink + '.xml',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.88 Safari/537.36'
            },
            method: 'get'
        },
        function(err, res, body) {
            parseString(body, function(err,data) {
                var arr = data.hash.variants[0].variant;
                for (var i = 0; i < arr.length; i++) {
                    var curSize = arr[i].title[0];
                    // TODO: include size param for clothes as well
                    if (curSize.includes('9')) {
                        console.log(arr[i]["id"][0]._);
                        opn(siteLink + '/cart/' + arr[i]["id"][0]._ + ":1");
                        cb(siteLink + '/cart/' + arr[i]["id"][0]._ + ":1");
                        break;
                    } else if (i + 1 === arr.length) {
                        console.log('Adding the largest size found');
                        opn(siteLink + '/cart/' + arr[i]["id"][0]._ + ":1");
                        cb(siteLink + '/cart/' + arr[i]["id"][0]._ + ":1");
                    }
                }
            })
        });
}

module.exports.getProduct = getProductLink;