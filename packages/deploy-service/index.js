const { UniversalDeposits } = require('@universal-deposits/sdk')

const main = async () => {
  const destinationAddress = ''
  const destinationToken = ''
  const destinationChain = 10020

  console.log(UniversalDeposits)
  const ciao = new UniversalDeposits({
    destinationAddress,
    destinationToken,
    destinationChain,
  })

  ciao.print()
}

main()
