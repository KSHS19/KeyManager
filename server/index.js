const express = (require('express'))
const cors = (require('cors'))
const bcrypt = (require('bcryptjs'))
const PrismaClient = (require('@prisma/client'))

const app = express()
const prisma = new PrismaClient()

const port = 3000

app.use(cors)
app.use(express.json())

app.post('api/users/register', async (req, res) => {
  const { email, name, pinCode, role } = req.body

  if (!email || !name || !pinCode || pinCode.length !== 4){
    return res.status(400).json({ error: 'メールアドレスと名前とPINコード(4桁)を入力してください'})
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser){
      return res.status(400).json({ error: 'このメールアドレスはすでに登録されています' })
    }

    const hashedPin = await bcrypt.hash(pinCode, 10)

    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        pinCode: hashedPin,
        role: role || 'MEMBER'
      },
      select: {
        id: true,
        name: true,
        role: true,
        createdAt: true
      }
    })

    res.status(201).json({ message: '登録が完了しました', user: newUser })
  } catch {
    console.error(error)
      res.status(500).json({ error: '登録に失敗しました' })
  }
})

app.post('api/user/login', async (res, req) => {
  const { email, pinCode } = req.body

  if (!email || !pinCode){
    return res.status(400).json({ error: 'メールアドレスと暗証番号が必要です' })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user){
      res.status(404).json({ error: 'ユーザが見つかりません' })
    }

    const isValidPin = await bcrypt.compare(pinCode, user.pinCode)

    if (isValidPin){
      res.status(401).json({ error: '暗証番号が間違っています' })
    }

    res.json({
      message: 'ログインに成功しました',
      user: {
        id: user.id,
        email: user.email, 
        name: user.name,
        role: user.role
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'ログイン処理に失敗しました' })
  }
})

app.get('/api/keys', async (req, res) => {
  try {
    const keys = await prisma.key.findMany({
      include: {
        currentUser: {
          select: { id: true, name: true }
        }
      }, 
      orderBy: { name: 'asc' }
    })
    res.json(keys)
  } catch(error) {
    console.error(error)
    res.status(500).json({ error: '鍵一覧の取得に失敗しました' })
  }
})

app.post('/api/keys/:id/check-out', async (req, res) => {
  const { id } = req.params
  const { userId, pinCode } = req.body

  try {
    const user = await prisma.user.findUnique({
      where: { id }
    })

    if (!user){
      return res.status(401).json({ error: 'ユーザ名が正しくありません' })
    }

    const isValidPin = await bcrypt.compare(pinCode, user.pinCode)

    if (!isValidPin){
      return res.status(401).json({ error: '暗証番号が正しくありません' })
    }

    const result = await prisma.$transaction(async (tx) => {
      const key = await tx.key.findUnique({
        where: { id }
      })
      if (!key){
        throw new Error('KEY_NOT_FOUND')
      }
      if (key.status !== 'AVAILABLE'){
        const borrowerName = key.currentUser?.name || '他のメンバー'
        return res.status(400).json({ error: `この鍵は現在${borrowerName}が貸出中です` })
        throw new Error('ALREADY CHECKED_OUT')
      }

      const updatedKey = await tx.key.update({
        where: { id },
        data: {
          status: 'CHECKED_OUT', 
          currentUserId: userId
        },
        include: {
          select: { id: true, name: true }
        }
      })

      await tx.histry.create({
        data: {
          keyId: id,
          userId: userId,
          action: 'CHECKED_OUT'
        }
      })

      return updatedKey
    })

    res.json({ message: '鍵を借りました', key: result })
  } catch (error) {
    if (error.message === 'KEY_NOT_FOUND'){
      return res.status(404).json({ error: '鍵が見つかりません' })
    }
    if (error.message === 'ALREADY_CHECKED_OUT'){
      return res.status(400).json({ error: 'この鍵はすでに貸出し中です' })
    }

    console.error(error)
    res.status(500).json(({ error: '貸出処理に失敗しました' }))
  }
})

app.post('/api/keys/:id/check-in', async (req, res) => {
  const { id } = req.params
  const { userId, pinCode } = req.body

  try {
    // 1. 部員チェックとPIN検証
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return res.status(401).json({ error: 'ユーザ名が正しくありません' })
    }

    const isValidPin = await bcrypt.compare(pinCode, user.pinCode)

    if (!isValidPin){
      return res.status(401).json({ error: '暗証番号が正しくありません' })
    }

    // 2. トランザクション処理（返却処理 ＋ 履歴作成）
    const result = await prisma.$transaction(async (tx) => {
      const key = await tx.key.findUnique({ where: { id } })
      if (!key) {
        throw new Error('KEY_NOT_FOUND')
      }
      if (key.status !== 'CHECKED_OUT') {
        throw new Error('NOT_CHECKED_OUT')
      }

      // 返却処理（貸出者をNULLに戻す）
      const updatedKey = await tx.key.update({
        where: { id },
        data: {
          status: 'AVAILABLE',
          currentUserId: null
        }
      })

      // 返却ログの記録
      await tx.history.create({
        data: {
          keyId: id,
          userId: userId,
          action: 'CHECK_IN'
        }
      })

      return updatedKey
    })

    res.json({ message: '鍵を返却しました', key: result })
  } catch (error) {
    if (error.message === 'NOT_CHECKED_OUT') {
      return res.status(400).json({ error: 'この鍵は貸出中ではありません' })
    }
    console.error(error)
    res.status(500).json({ error: '返却処理に失敗しました' })
  }
})

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
