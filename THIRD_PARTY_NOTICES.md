# Third-party notices

## OCS font helpers

`src/vendor/ocs-font-helpers.js` contains font feature recognition helpers adapted from **OCS 网课助手 v5.2.1**, copyright **enncy**, under the MIT License. The same notice is retained in the generated userscript. It covers the reference-table loader, raster feature extraction, feature matching and embedded-font extraction helpers. Other modules in this project provide their own integration, Unicode coverage handling, playback, AI and workflow code.

```text
Copyright (c) enncy. MIT License.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

The external font reference binary is downloaded at runtime from `cdn.ocsjs.com` and is not bundled in this repository. This notice does not assign a license to that external data or service.

## Development dependencies

The test suite uses `linkedom` (ISC) and its transitive npm dependencies. Exact versions and available license metadata are recorded in `package-lock.json`. `node_modules` is not distributed in the project archive; installed dependencies retain their own license files.
