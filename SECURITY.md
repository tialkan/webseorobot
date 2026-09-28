# Güvenlik politikası

Güvenlik açığını herkese açık issue olarak paylaşmayın. Depo sahibiyle GitHub Security Advisory üzerinden özel olarak iletişime geçin.

## Sunucu tarafı istek güvenliği

WebSEORobot bilerek uzak adreslere HTTP isteği gönderir. Motor şu savunmaları uygular:

- yalnızca `http:` ve `https:`;
- yalnızca 80 ve 443 portları;
- URL içinde kullanıcı adı/parola yasağı;
- localhost, `.local`, özel, loopback, link-local, multicast ve ayrılmış IP aralıklarının reddi;
- DNS yanıtlarının ve her yönlendirme hedefinin tekrar doğrulanması;
- istek süresi, yönlendirme sayısı ve gövde boyutu sınırı;
- taranan sayfa ve sitemap örneklemi sınırı.

DNS doğrulaması tek başına kusursuz bir ağ sınırı değildir. Genel kullanıma açık kurulumlarda bulut metadata uç noktalarını ve iç ağları egress firewall/proxy ile ayrıca engelleyin, oran sınırlama uygulayın ve süreci ayrıcalıksız çalıştırın.
