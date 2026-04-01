App({
  onLaunch() {
    wx.cloud.init({
      env: 'https://fan-240142-10-1417324185.sh.run.tcloudbase.com'
    })
  }
})