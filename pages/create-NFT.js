import { ethers } from 'ethers'
import { useState, useEffect } from 'react'
import axios from 'axios'
import Web3Modal from 'web3modal'
import { create as ipfsHttpClient } from 'ipfs-http-client'
import { useRouter } from 'next/router'

const client = ipfsHttpClient('https://ipfs.infura.io:5001/api/v0')

import {
    nftAddress, marketPlaceAddress
} from '../config'

import NFT from '../artifacts/contracts/NFT.sol/NFT.json'
import NFTMarket from '../artifacts/contracts/NFTMarket.sol/NFTMarket.json'
import { route } from 'next/dist/server/router'

export default function CreateNFT() {
    const [fileUrl, setFileUrl] = useState(null)
    const [formInput, updateFormInput] = useState({ price: '', name: '', description: '' })
    const router = useRouter()

    async function onChange(e) {
        const file = e.target.files[0]

        try {
            const added = await client.add(
                file,
                {
                    progress: (prog) => console.log(`received: ${prog}`)
                }
            )
            const url = `https://ipfs.infura.io/ipfs/${added.path}`
            setFileUrl(url)
        } catch (e) {
            console.log(e)
        }
    }

    async function createNFT() {
        const { name, description, price } = formInput
        if (!name || !description || !price || !fileUrl) return

        const data = JSON.stringify({
            name, description, image: fileUrl
        })

        try {
            const added = await client.add(data)
            const url = `https://ipfs.infura.io/ipfs/${added.path}`

            createSale(url)
        } catch (e) {
            console.log('Error uploading file: ', e)
        }
    }

    async function createSale(url) {
        const web3modal = new Web3Modal()
        const connection = await web3modal.connect()
        const provider = new ethers.providers.Web3Provider(connection)
        const signer = provider.getSigner()

        let contract = new ethers.Contract(nftAddress, NFT.abi, signer)
        let transaction = await contract.createToken(url)
        let tx = await transaction.wait()

        let event = tx.events[0]
        let value = event.args[2]
        let tokenId = value.toNumber()

        const price = ethers.utils.parseUnits(formInput.price, 'ether')

        contract = new ethers.Contract(marketPlaceAddress, NFTMarket.abi, signer)
        let listingPrice = await contract.getListingPrice()
        listingPrice = listingPrice.toString()

        transaction = await contract.createMarketItem(
            nftAddress, tokenId, price, { value: listingPrice }
        )
        await transaction.wait()
        router.push('/')
    }

    return (
        <div className="flex justify-center">
            <div className="w-1/2 flex flex-col pb-12">
                <input
                    placeholder="Asset Name"
                    className="mt-8 border rounded p-4"
                    onChange={e => updateFormInput({ ...formInput, name: e.target.value })}
                />
                <textarea
                    placeholder="Asset Description"
                    className="mt-2 border rounded p-4"
                    onChange={e => updateFormInput({ ...formInput, description: e.target.value })}
                />
                <input
                    placeholder="Asset Price"
                    className="mt-2 border rounded p-4"
                    onChange={e => updateFormInput({ ...formInput, price: e.target.value })}
                />
                <input
                    type="file"
                    name="Asset"
                    className="my-4"
                    onChange={onChange}
                />
                {
                    fileUrl && (
                        <img className="rounded mt-4" width="350" src={fileUrl} />
                    )
                }
                <button onClick={createNFT} className="font-bold mt-4 bg-pink-500 text-white rounded p-4 shadow-lg">
                    Create NFT
                </button>
            </div>
        </div>
    )

}
