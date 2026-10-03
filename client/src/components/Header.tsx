import { Link } from "react-router"

function Header() {
    return (
        <>
            <div className="border-b-2 border-gray-200 px-4 py-2">
                <Link to="/">
                    <p className="text-xl font-bold">鍵管理システム</p>
                </Link>
                <Link to="/login">
                    <p className="text-xl font-bold">ログイン</p>
                </Link>
                <Link to="/register">
                    <p className="text-xl font-bold">新規登録</p>
                </Link>
            </div>
        </>
    )
}

export default Header