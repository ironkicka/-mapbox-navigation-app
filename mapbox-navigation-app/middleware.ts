import { NextRequest, NextResponse } from 'next/server'

export const middleware = (req: NextRequest) => {
  const basicAuth = req.headers.get('authorization')
  const url = req.nextUrl
  //HeaderにAuthorizationが定義されているかをチェック
  if (basicAuth) {
    const auth = basicAuth.split(' ')[1]
    //The edge runtime does not support Node.js 'buffer' module.
    //https://nextjs.org/docs/api-reference/edge-runtime
    const [user, pwd] = atob(auth).toString().split(':')
    // basic認証のUser/Passが、envファイルにある値と同じかをチェック
    if (user ===  process.env.NEXT_PUBLIC_USER && pwd === process.env.NEXT_PUBLIC_PASS) {
      return NextResponse.next()
    }
  }
  url.pathname = '/api/auth'

  return NextResponse.rewrite(url)
}
