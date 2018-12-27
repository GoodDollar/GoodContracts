pragma solidity ^0.4.24;

import "./Heap.sol";

library Median {

    using Heap for Heap.Data;
    struct Data
    {
        Heap.Data ltMedianHeap;
        Heap.Data gtMedianHeap;
        int medianValue;

    }
    

    function init(Data storage self) internal{
        self.medianValue = 0;
        //max heap
        self.ltMedianHeap.init(true);
        //min heap
        self.gtMedianHeap.init(false);

    }

    function updateMedian(Data storage self, address _addr, uint _balance) internal returns(Heap.Node memory)
    {
        int sBalance = int(_balance);
        require(uint(sBalance) == _balance,"sign overflow");
        //add to the appropriate heap
        // if n is greater than or equal to current median, add to gtHeap
        Heap.Node memory res;
        if(sBalance >= self.medianValue)
        {
            //first check its not in ltHeap (ie we are updating an account balance)
            if(self.ltMedianHeap.indices[_addr] == 0)
                self.ltMedianHeap.extractById(_addr);
            res =  self.gtMedianHeap.insertOrUpdate(_addr, sBalance);
        }
        // if n is less than current median, add to min heap
        else
        {
            //first check its not in gtHeap (ie we are updating an account balance)
            if(self.gtMedianHeap.indices[_addr] == 0)
                self.gtMedianHeap.extractById(_addr);
            res = self.ltMedianHeap.insertOrUpdate(_addr, sBalance);
        }

        rebalance(self);
        self.medianValue = median(self);
        return res;


    }

    function median(Data storage self) internal view returns (int) {
        //if total size(no. of elements entered) is even, then median iss the average of the 2 middle elements
        //i.e, average of the root's of the heaps.
        if(self.ltMedianHeap.size() == self.gtMedianHeap.size()){ 
            return (self.ltMedianHeap.getMax().priority + self.gtMedianHeap.getMax().priority)/2;
        }
        //else median is middle element, i.e, root of the heap with one element more
        else if(self.ltMedianHeap.size() > self.gtMedianHeap.size()) return self.ltMedianHeap.getMax().priority;
        else return self.gtMedianHeap.getMax().priority;

    }

    function rebalance(Data storage self) internal{
        //if sizes of heaps differ by 2, then it's a chaos, since median must be the middle element
        if( uint(self.ltMedianHeap.size() - self.gtMedianHeap.size()) > 1) {
            Heap.Node memory n;
            //check which one is the culprit and take action by kicking out the root from culprit into victim
            if(self.ltMedianHeap.size() > self.gtMedianHeap.size()){
                n = self.ltMedianHeap.extractMax();
                self.gtMedianHeap.insertOrUpdate(n.id,n.priority*self.ltMedianHeap.minmaxMultiplier);
            }
            else {
                n = self.gtMedianHeap.extractMax();
                self.gtMedianHeap.insertOrUpdate(n.id,n.priority*self.gtMedianHeap.minmaxMultiplier);
            }
        }
    }

}