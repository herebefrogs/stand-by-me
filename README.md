Stand by me
====================

Getting Started
---------------

```
npm start
-> build game, open a browser, watch source and livereload browser on changes

npm run build
-> build game for gamejam submission (no sourcemap and livereload script)
```


Web Monetization
----------------
To enable Web Monetization, uncomment the call to `checkMonetization` in `onload`. This will add listeners to handle monetization events. At the appropriate time in your code, check `isMonetizationEnabled` to decide if extra features should be accessible or not. Remember to update the value of the `monetization` meta tag in `src/index.html` to your payment pointer.

Special Thanks & Credits
------------------------
- [CarelessCoder](https://twitter.com/CarelessLabs/status/1433798961823993858) for his function getting x,y from an angle
- [Steven Lambert](https://twitter.com/StevenKLambert) for his Pseudo Random Number Generator from Kontra.js
- [Frank Force](https://twitter.com/KilledByAPixel) and [Keith Clark](https://keithclark.co.uk/) for their über smoll sound & music players, [ZzFX](https://github.com/KilledByAPixel/ZzFX) and [ZzFX Music](https://github.com/keithclark/ZzFXM) respectively
- [Matt](https://twitter.com/Smflyf) for pointing out the existence of `advzip-bin`
- Florent Cailhol for suggesting Terser in place of UglifyJS
- [Maxime Euziere](https://twitter.com/MaximeEuziere) for his switch/case approach to handling game screens in update/render/input handlers
- [Ryan Malm](https://twitter.com/ryanmalm) for sharing his Twitter message code
- [Peters](https://twitter.com/p1100i) and [flo-](https://twitter.com/fl0ptimus_prime) for their pixel font from Glitch Hunter
- Eoin McGrath for his original build script
