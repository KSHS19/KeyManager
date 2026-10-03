import { Link } from 'react-router'
import Header from './../components/Header.tsx'

function Home() {
    return (
        <>
            <Header />
            <p>あの教室の鍵っていつ借りれるんだいっけ？</p>
            <p>あれ、部室の鍵返したっけ？</p>
            <p>そんな悩みを解決します</p>

            <Link to="/register">新規登録</Link>
            <Link to="/login">ログイン</Link>

        </>
    )
}

export default Home