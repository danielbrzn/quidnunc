const fs = require('fs');
const open = require('open');
const cheerio = require('cheerio');
const phoneFormatter = require('phone-formatter');

const j = require('request').jar();
const request = require('request').defaults({
    timeout: 10000,
    jar: j,
});

const states = require('../states.json');
const log = require('../utils/log');
const readline = require('readline');

const userAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36';
let price, storeID, url, checkoutHost, checkoutID, sValue;
let match;
let styleID;

module.exports = {};

function pay(config, slackBot, _match, cartLink) {
    match = _match;
    request(
        {
            url: cartLink,
            followAllRedirects: true,
            method: 'get',
            headers: {
                'User-Agent': userAgent,
            },
            //formData: {
            //    quantity: '1',
            //    checkout: 'Checkout',
            //},
        },
        function (err, res, body) {
            if (err) {
                log(err, 'error');
            }
            log('Added to cart!');
            log('Checking out your item...');
            checkoutHost = 'https://' + res.request.originalHost;
            if (res.request.href.indexOf('stock_problems') > -1) {
                log(
                    `This item is currently Sold Out, sorry for the inconvenience`
                );
                process.exit(1);
            }

            // simulate queue
            if (res.request.href.indexOf('throttle') > -1)  {
                var queueLink = res.request.href;
                ///console.log(res);
                //console.log(body);
                //console.log()
                const queuePollUrl = 'https://' + res.request.originalHost + '/checkout/poll?js_poll=1';
                log('Queue Poll Url: ' + queuePollUrl);
                function pollUrl(queuePollUrl) {
                    request({
                            url: queuePollUrl,
                            method: 'get',
                            headers: {
                                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                                Host:  res.request.originalHost,
                                Referer: res.request.href,
                                'User-Agent': userAgent,
                            },
                        },
                        function (err, res, body) {
                            if (res.statusCode === parseInt('202')) {
                                console.log('Waiting in queue...');
                                setTimeout( () => pollUrl(queuePollUrl), 2000);
                            } else {
                                console.log(res.statusCode);
                                console.log(queueLink);
                                log('Passed Queue');
                                request(
                                    {
                                        url: cartLink,
                                        followAllRedirects: true,
                                        method: 'get',
                                        headers: {
                                            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                                            Host:  res.request.originalHost,
                                            Referer: queueLink,
                                            'User-Agent': userAgent,
                                        },
                                    }, function(err, res, body) {
                                        log('Added to cart!');
                                        log('Checking out your item...');
                                        checkoutHost = 'https://' + res.request.originalHost;
                                        if (res.request.href.indexOf('stock_problems') > -1) {
                                            log(
                                                `This item is currently Sold Out, sorry for the inconvenience`
                                            );
                                            process.exit(1);
                                        }
                                        const $ = cheerio.load(body);
                                        url = res.request.href;
                                        if (res.request.href.indexOf('stock_problems') > -1) {
                                            log(
                                                `This item is currently Sold Out, sorry for the inconvenience`
                                            );
                                            process.exit(1);
                                        }
                                        log(url);
                                        checkoutID = url.split('checkouts/')[1];
                                        storeID = url.split('/')[3];
                                        const auth_token = "placeholder";
                                        log(`Store ID: ${storeID}`);
                                        log(`Checkout ID: ${checkoutID}`);
                                        price = $('#checkout_total_price').text();
                                        //slackNotification(config, slackBot, '#36a64f', 'Added to Cart');
                                        //opn(url);

                                        const rl = readline.createInterface({
                                            input: process.stdin,
                                            output: process.stdout
                                        });

                                        rl.question('Enter captcha token: ', answer => input(config, slackBot, auth_token, answer, res.request.originalHost));
                                    });

                            }
                        });
                };
                pollUrl(queuePollUrl);
            } else {

                const $ = cheerio.load(body);
                url = res.request.href;
                log(url);
                checkoutID = url.split('checkouts/')[1];
                storeID = url.split('/')[3];
                const auth_token = "placeholder";
                log(`Store ID: ${storeID}`);
                log(`Checkout ID: ${checkoutID}`);
                price = $('#checkout_total_price').text();
                //slackNotification(config, slackBot, '#36a64f', 'Added to Cart');
                //opn(url);

                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });

                rl.question('Enter captcha token: ', answer => input(config, slackBot, auth_token, answer, res.request.originalHost));

            }

        }
    );
}

module.exports.pay = pay;

function input(config, slackBot, auth_token, answer, host) {
    //console.log(answer);
    const ccInfo = {
        credit_card: {
            number: config.ccn,
            verification_value: config.ccv,
            name: config.firstName + ' ' + config.lastName,
            month: parseInt(config.month),
            year: parseInt(config.year),
        },
    };
    request(
        {
            url: `https://elb.deposit.shopifycs.com/sessions`,
            followAllRedirects: true,
            method: 'post',
            headers: {
                'User-Agent': userAgent,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(ccInfo),
        }, function(err, res, body) {
            sValue = JSON.parse(body).id;
            //console.log("sValue: " + sValue);
        });

    log(`Checkout URL: ${url}`);
    let form;

    form = {
        'utf8': '✓',
        '_method': 'patch',
        //'authenticity_token': auth_token,
        'previous_step': 'contact_information',
        'step': 'shipping_method',
        'checkout[email]': config.email,
        'checkout[shipping_address][first_name]': config.firstName,
        'checkout[shipping_address][last_name]': config.lastName,
        'checkout[shipping_address][company]': '',
        'checkout[shipping_address][address1]': config.address,
        'checkout[shipping_address][address2]': config.address2,
        'checkout[shipping_address][city]': config.city,
        'checkout[shipping_address][country]': 'Singapore',
        'checkout[shipping_address][province]': '',
        'checkout[shipping_address][zip]': config.zipCode,
        'checkout[shipping_address][phone]': config.phoneNumber,
        'g-recaptcha-response': answer,
        'button': '',
        'checkout[client_details][browser_width]': '979',
        'checkout[client_details][browser_height]': '631',
        'checkout[client_details][javascript_enabled]': '1'
    };
    //console.log(form);
    request(
        {
            url: url,
            followAllRedirects: true,
            headers: {
                Origin: `${checkoutHost}`,
                'User-Agent': userAgent,
                Accept:
                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                Referer: `${checkoutHost}/`,
                'Accept-Language': 'en-US,en;q=0.8',
                'Upgrade-Insecure-Requests': '1',
                'Host': host,
                'Cache-Control': 'max-age=0'
            },
            method: 'post',
            form: form,
        },
        function(err, res, body) {
            if (err) {
                log(err, 'error');
            }
            const $ = cheerio.load(body);
            //console.log($('head > title').html());
            //console.log($('form.edit_checkout input[name=authenticity_token]').attr('value'));
            const firstShippingOption = $(
                'div.content-box__row .radio-wrapper'
            ).attr('data-shipping-method');
            //console.log(firstShippingOption);
            return submitShipping(config, slackBot, {
                type: 'direct',
                value: firstShippingOption,
                auth_token: 'placeholder'
                //auth_token: $('input[name="authenticity_token"]').val(),
            });
        }
    );
}

function submitShipping(config, slackBot, res) {
    if (res.type == 'poll') {
        log(`Shipping Poll URL: ${checkoutHost}${res.value}`);
        log(`Timing out Shipping for ${config.shipping_pole_timeout}ms`);

        setTimeout(function() {
            request(
                {
                    url: checkoutHost + res.value,
                    method: 'post',
                    headers: {
                        Accept:
                            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'User-Agent': userAgent,
                    },
                },
                function(err, res, body) {
                    const $ = cheerio.load(body);

                    const shipping_method_value = $('.radio-wrapper').attr(
                        'data-shipping-method'
                    );
                    const auth_token = 'placeholder';
                    /*
                    const auth_token = $(
                        'form[data-shipping-method-form="true"] input[name="authenticity_token"]'
                    ).attr('value');
                    */
                    log(`Shipping Method Value: ${shipping_method_value}`);
                    log('Card information sending...');

                    request(
                        {
                            url: url,
                            followAllRedirects: true,
                            method: 'post',
                            headers: {
                                'User-Agent': userAgent,
                                'Content-Type': 'application/x-www-form-urlencoded',
                            },
                            formData: {
                                utf8: '✓',
                                _method: 'patch',
                                //authenticity_token: auth_token,
                                button: '',
                                previous_step: 'shipping_method',
                                step: 'payment_method',
                                'checkout[shipping_rate][id]': shipping_method_value,
                            },
                        },
                        function(err, res, body) {
                            const $ = cheerio.load(body);

                            const price = $('input[name="checkout[total_price]"]').attr(
                                'value'
                            );
                            const payment_gateway = $(
                                'input[name="checkout[payment_gateway]"]'
                            ).attr('value');
                            /*
                            const new_auth_token = $(
                                'form[data-payment-form=""] input[name="authenticity_token"]'
                            ).attr('value');
                            */
                            const new_auth_token = "placeholder";
                            // log(`Final Auth Token: ${new_auth_token}`);
                            // log(`Price: ${price}`);
                            // log(`Payment Gateway ID: ${payment_gateway}`);

                            submitCC(
                                config,
                                slackBot,
                                new_auth_token,
                                price,
                                payment_gateway
                            );
                        }
                    );
                }
            );
        }, parseInt(config.shipping_pole_timeout));
    } else if (res.type == 'direct') {
        log(`Shipping Method Value: ${res.value}`);
        log('Card information sending...');

        request(
            {
                url: url,
                followAllRedirects: true,
                method: 'post',
                headers: {
                    'User-Agent': userAgent,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                formData: {
                    utf8: '✓',
                    _method: 'patch',
                    authenticity_token: res.auth_token,
                    button: '',
                    previous_step: 'shipping_method',
                    step: 'payment_method',
                    'checkout[shipping_rate][id]': res.value,
                },
            },
            function(err, res, body) {
                const $ = cheerio.load(body);
                const payment_gateway = $(
                    'input[name="checkout[payment_gateway]"]'
                ).attr('value');
                const new_auth_token = $(
                    'form[data-payment-form=""] input[name="authenticity_token"]'
                ).attr('value');

                const price = $('#checkout_total_price').attr('value');

                log(`Price: ${price}`);
                log(`Payment Gateway ID: ${payment_gateway}`);

                submitCC(config, slackBot, new_auth_token, price, payment_gateway);
            }
        );
    }
}

function submitCC(config, slackBot, new_auth_token, price, payment_gateway) {
    request(
        {
            url: url,
            followAllRedirects: true,
            method: 'post',
            headers: {
                Origin: checkoutHost,
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept:
                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.8',
                Referer: `${checkoutHost}/${storeID}/checkouts/${checkoutID}`,
                'User-Agent': userAgent,
            },
            formData: {
                utf8: '✓',
                _method: 'patch',
                //authenticity_token: new_auth_token,
                previous_step: 'payment_method',
                step: '',
                s: sValue,
                'checkout[payment_gateway]': payment_gateway,
                'checkout[credit_card][vault]': 'false',
                'checkout[different_billing_address]': 'false',
                'checkout[billing_address][first_name]': config.firstName,
                'checkout[billing_address][last_name]': config.lastName,
                'checkout[billing_address][company]': '',
                'checkout[billing_address][address1]': config.address,
                'checkout[billing_address][address2]': config.address2,
                'checkout[billing_address][city]': config.city,
                'checkout[billing_address][country]': 'Singapore',
                'checkout[billing_address][province]': '',
                'checkout[billing_address][zip]': config.zipCode,
                'checkout[billing_address][phone]': config.phoneNumber,
                'checkout[total_price]': price,
                complete: '1',
                'checkout[client_details][browser_width]': '979',
                'checkout[client_details][browser_height]': '631',
                'checkout[client_details][javascript_enabled]': '1',
            },
        },
        function(err, res, body) {
            console.log(body);
            if (process.env.DEBUG) {
                fs.writeFile('debug.html', body, function(err) {
                    if (err) {
                        log(err, 'error');
                    }
                    log(
                        'The file debug.html was saved the root of the project file.'
                    );
                });
            }
            const $ = cheerio.load(body);
            if ($('input[name="step"]').val() == 'processing') {
                log(
                    'Payment is processing, go check your email for a confirmation.'
                );
                slackNotification(
                    config,
                    slackBot,
                    '#36a64f',
                    'Payment is processing, go check your email for a confirmation.'
                );
                setTimeout(function() {
                    return process.exit(1);
                }, 4500);
            } else if ($('title').text().indexOf('Processing') > -1) {
                log(
                    'Payment is processing, go check your email for a confirmation.'
                );
                slackNotification(
                    config,
                    slackBot,
                    '#36a64f',
                    'Payment is processing, go check your email for a confirmation.'
                );
                setTimeout(function() {
                    return process.exit(1);
                }, 4500);
            } else if (res.request.href.indexOf('paypal.com') > -1) {
                slackNotification(
                    config,
                    slackBot,
                    '#4FC3F7',
                    `This website only supports PayPal and is currently incompatible with Trimalchio, sorry for the inconvenience. <${res
                        .request.href}|Click Here>`
                );
                const open = require('open');
                log(
                    'This website only supports PayPal and is currently incompatible with Trimalchio, sorry for the inconvenience. A browser session with the PayPal checkout will open momentarily.'
                );
                open(res.request.href);
                setTimeout(function() {
                    return process.exit(1);
                }, 3000);
            } else if ($('div.notice--warning p.notice__text')) {
                if ($('div.notice--warning p.notice__text') == '') {
                    slackNotification(
                        config,
                        slackBot,
                        '#ef5350',
                        'An unknown error has occured.'
                    );
                    log(`An unknown error has occured please try again.`, 'error');
                    setTimeout(function() {
                        return process.exit(1);
                    }, 4500);
                } else {
                    slackNotification(
                        config,
                        slackBot,
                        '#ef5350',
                        `${$('div.notice--warning p.notice__text').eq(0).text()}`
                    );
                    log(
                        `${$('div.notice--warning p.notice__text').eq(0).text()}`,
                        'error'
                    );
                    setTimeout(function() {
                        return process.exit(1);
                    }, 4500);
                }
            } else {
                slackNotification(
                    config,
                    slackBot,
                    '#ef5350',
                    'An unknown error has occured.'
                );
                log(`An unknown error has occured please try again.`, 'error');
                setTimeout(function() {
                    return process.exit(1);
                }, 4500);
            }
        }
    );
}

function slackNotification(config, slackBot, color, type) {
    if (config.slack.active) {
        const params = {
            username: config.slack.settings.username,
            icon_url: config.slack.settings.icon_url,
            attachments: [
                {
                    thumb_url: match.images[0].src,
                    fallback: match.title + ': ' + type,
                    title: match.title,
                    title_link: config.base_url + '/' + match.handle,
                    color: color,
                    fields: [
                        {
                            title: 'Notification Message',
                            value: type,
                            short: 'false',
                        },
                        {
                            title: 'Checkout URL',
                            value: `<${url}|Click Here>`,
                            short: 'false',
                        },
                        {
                            title: 'Price',
                            value: price,
                            short: 'false',
                        },
                        {
                            title: 'Keyword(s)',
                            value: config.keywords,
                            short: 'false',
                        },
                    ],
                    footer: 'Trimalchio',
                    ts: Math.floor(Date.now() / 1000),
                    footer_icon: 'http://i.imgur.com/06ubORD.jpg',
                },
            ],
        };
        slackBot.postMessage(config.slack.channel, null, params);
    }
}

module.exports.slackNotification = slackNotification;